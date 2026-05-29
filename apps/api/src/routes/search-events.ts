import { z } from "zod";
import { router, procedure } from "../trpc/init";
import { retrieveCandidateUrls } from "../lib/tavily";
import {
  fetchPageMetadataDetailed,
  type FetchPageResult,
} from "../lib/page-fetch";
import {
  extractEventsFromPageWithAI,
  type ExtractedEvent,
  extractedEventSchema,
} from "../lib/event-extractor";
import type { PageMetadata } from "../lib/page-fetch";

const eventTagEnum = z.enum([
  "music",
  "food-drink",
  "nightlife",
  "arts-culture",
  "comedy",
  "sports",
  "family",
  "community",
  "outdoors",
  "markets-fairs",
  "workshops",
  "seasonal",
  "pride",
]);

const candidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  sourceUrl: z.string(),
  snippet: z.string(),
  score: z.number().nullable(),
  primaryTag: eventTagEnum,
  tags: z.array(eventTagEnum).min(1).max(5),
});

const extractedPagePreviewSchema = z.object({
  url: z.string(),
  title: z.string().nullable(),
  sourceDomain: z.string(),
  publishedDate: z.string().nullable(),
  // Debug preview field: some sites return relative/non-standard og:image values.
  image: z.string().nullable(),
  contentPreview: z.string(),
  contentLength: z.number().int().nonnegative(),
});

const parsedEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().nullable(),
  venue: z.string().nullable(),
  location: z.string(),
  sourceUrl: z.string(),
  imageUrl: z.string().nullable(),
  primaryTag: eventTagEnum,
  tags: z.array(eventTagEnum).min(1).max(5),
  confidence: z.number().min(0).max(1),
});

const rejectedPageSchema = z.object({
  url: z.string(),
  reason: z.string(),
});

const searchEventsResponseSchema = z.object({
  stage: z.enum(["candidate", "event"]),
  queryPlan: z.object({
    location: z.string(),
    intentPrompts: z.array(z.string()).min(1),
    dateRange: z.object({
      startIso: z.string().datetime(),
      endIso: z.string().datetime(),
    }),
  }),
  candidateCount: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  candidates: z.array(candidateSchema),
  parsedEvents: z.array(parsedEventSchema),
  rejectedPages: z.array(rejectedPageSchema),
  extraction: z.object({
    requestedUrls: z.number().int().nonnegative(),
    extractedPages: z.number().int().nonnegative(),
    pages: z.array(extractedPagePreviewSchema),
    debug: z.object({
      jsonLdEventsFound: z.number().int().nonnegative(),
      aiEventsFound: z.number().int().nonnegative(),
      pagesProcessedByAi: z.number().int().nonnegative(),
      pagesUsingJsonLd: z.number().int().nonnegative(),
      pagesUsingAi: z.number().int().nonnegative(),
    }),
  }),
});

type EventTag = z.infer<typeof eventTagEnum>;
type ParsedEvent = z.infer<typeof parsedEventSchema>;
type SearchPlan = {
  location: string;
  intentPrompts: string[];
  dateRange: {
    startIso: string;
    endIso: string;
  };
};

function inferTagsFromText(text: string): {
  primaryTag: EventTag;
  tags: EventTag[];
} {
  const t = text.toLowerCase();

  const rules: Array<{ tag: EventTag; match: RegExp }> = [
    { tag: "music", match: /\b(music|concert|dj|band|show|festival)\b/ },
    {
      tag: "food-drink",
      match: /\b(food|drink|restaurant|brewery|wine|cocktail)\b/,
    },
    { tag: "nightlife", match: /\b(nightlife|club|late night|bar)\b/ },
    { tag: "arts-culture", match: /\b(art|museum|gallery|theater|cultural)\b/ },
    { tag: "comedy", match: /\b(comedy|standup|stand-up|improv)\b/ },
    { tag: "sports", match: /\b(sports|game|match|tournament|athletic)\b/ },
    { tag: "family", match: /\b(family|kids|children)\b/ },
    { tag: "community", match: /\b(community|local|meetup|volunteer)\b/ },
    { tag: "outdoors", match: /\b(outdoor|hike|park|trail|nature)\b/ },
    { tag: "markets-fairs", match: /\b(market|fair|farmers market|bazaar)\b/ },
    { tag: "workshops", match: /\b(workshop|class|training|seminar)\b/ },
    {
      tag: "seasonal",
      match: /\b(seasonal|holiday|christmas|halloween|summer)\b/,
    },
    {
      tag: "pride",
      match: /\b(pride|lgbtq|gay|lesbian|transgender|non-binary|queer)\b/,
    },
  ];

  const matched = rules.filter((r) => r.match.test(t)).map((r) => r.tag);
  const tags = matched.length
    ? Array.from(new Set(matched)).slice(0, 5)
    : (["community"] as EventTag[]);

  return { primaryTag: tags[0], tags };
}

async function buildSearchPlanFromUser(_userId: string): Promise<SearchPlan> {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 14);

  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  const startYmd = startIso.slice(0, 10);
  const endYmd = endIso.slice(0, 10);

  const location = "Saratoga Springs, UT";
  const radius = 80;

  // Keep each query concise for Tavily's 400-char limit.
  const intentPrompts = [
    `Events within ${radius} miles of ${location} from ${startYmd} to ${endYmd}. Return pages with concrete event records: title, date/time, venue, and ticket/info link. Include concerts, comedy, food, nightlife, markets, festivals, arts/culture, sports, community, family, and seasonal events.`,
    `Upcoming events within ${radius} miles of ${location} between ${startYmd} and ${endYmd}. Prioritize official event pages, venue calendars, ticket/detail pages, and community calendars with explicit event rows. Include free and paid events across ${eventTagEnum.options.join(", ")}.`,
    `Event listings within ${radius} miles of ${location} from ${startYmd} to ${endYmd} with concrete details (title, date/time, location, link). Focus on pages with actionable event rows or detail pages. Exclude travel guides, broad editorials, and non-event directories.`,
  ];

  return {
    location,
    intentPrompts,
    dateRange: {
      startIso,
      endIso,
    },
  };
}

function isDateInRange(
  dateIso: string,
  startIso: string,
  endIso: string,
): boolean {
  const dateMs = new Date(dateIso).getTime();
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  if (Number.isNaN(dateMs) || Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return false;
  }

  return dateMs >= startMs && dateMs <= endMs;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toIsoDateOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function extractString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function extractImageUrl(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.trim().length > 0) return item;
      if (item && typeof item === "object") {
        const fromUrl = extractString((item as Record<string, unknown>).url);
        if (fromUrl) return fromUrl;
      }
    }
  }
  if (value && typeof value === "object") {
    return extractString((value as Record<string, unknown>).url);
  }
  return null;
}

function extractLocationText(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const placeName = extractString(record.name);
  const address = record.address;
  if (typeof address === "string")
    return placeName ? `${placeName}, ${address}` : address;
  if (address && typeof address === "object") {
    const addr = address as Record<string, unknown>;
    const parts = [
      extractString(addr.streetAddress),
      extractString(addr.addressLocality),
      extractString(addr.addressRegion),
      extractString(addr.postalCode),
    ].filter(Boolean);
    if (parts.length > 0) {
      return placeName ? `${placeName}, ${parts.join(", ")}` : parts.join(", ");
    }
  }
  return placeName;
}

function collectJsonLdEvents(jsonLd: unknown[]): Record<string, unknown>[] {
  const collected: Record<string, unknown>[] = [];

  const walk = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    const maybeType = record["@type"];
    const types = Array.isArray(maybeType) ? maybeType : [maybeType];
    const isEvent = types.some(
      (t) => typeof t === "string" && t.toLowerCase() === "event",
    );

    if (isEvent) {
      collected.push(record);
    }

    Object.values(record).forEach(walk);
  };

  jsonLd.forEach(walk);
  return collected;
}

function extractEventsFromJsonLd(params: {
  page: PageMetadata;
  locationHint: string;
}): ExtractedEvent[] {
  const records = collectJsonLdEvents(params.page.jsonLd);

  return records
    .map((record) => {
      const title = extractString(record.name);
      const startDate = extractString(record.startDate);
      if (!title || !startDate) return null;

      const endDate = extractString(record.endDate);
      const summary = extractString(record.description);
      const sourceUrl =
        extractString(record.url) ??
        params.page.canonicalUrl ??
        params.page.finalUrl;
      const imageUrl = extractImageUrl(record.image) ?? params.page.ogImage;
      const location =
        extractLocationText(record.location) ?? params.locationHint;

      const { primaryTag, tags } = inferTagsFromText(
        `${title} ${summary ?? ""}`,
      );

      const extracted: ExtractedEvent = {
        title,
        startDate,
        endDate,
        venue: extractString(
          (record.location as Record<string, unknown> | undefined)?.name,
        ),
        location,
        summary,
        sourceUrl,
        imageUrl,
        primaryTag,
        tags,
        confidence: 0.82,
      };
      return extracted;
    })
    .filter((event): event is ExtractedEvent => Boolean(event));
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function canonicalizeCandidateUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";

    // Keep only params that can materially change event relevance.
    const keep = new Set(["q", "date", "category", "city", "start", "end"]);
    for (const key of Array.from(u.searchParams.keys())) {
      if (!keep.has(key)) u.searchParams.delete(key);
    }

    if (u.pathname.endsWith("/") && u.pathname !== "/") {
      u.pathname = u.pathname.slice(0, -1);
    }

    return u.toString();
  } catch {
    return raw;
  }
}

function isAssetUrl(url: string): boolean {
  const stripped = url.toLowerCase().split("?")[0]?.split("#")[0] ?? "";
  return /\.(jpg|jpeg|png|webp|gif|svg|ico|bmp|tiff|avif|pdf|css|js|xml|txt|zip|mp4|webm|mp3|wav)$/i.test(
    stripped,
  );
}

function isLikelyHubPage(params: {
  url: string;
  title: string | null;
  sourceDomain: string;
  linkCandidates: string[];
}): boolean {
  const urlLower = params.url.toLowerCase();
  const titleLower = (params.title ?? "").toLowerCase();
  const genericTitleSignals = [
    "events",
    "calendar",
    "things to do",
    "top",
    "best",
    "festival",
    "what's on",
  ];
  const hasGenericTitle = genericTitleSignals.some((signal) =>
    titleLower.includes(signal),
  );

  const hasHubPath =
    urlLower.includes("/events") ||
    urlLower.includes("/calendar") ||
    urlLower.includes("/things-to-do");

  // If the page has many outgoing links, it's likely a listing/index.
  return hasHubPath || hasGenericTitle || params.linkCandidates.length >= 15;
}

function looksLikeDetailUrl(url: string, sourceDomain: string): boolean {
  const lower = url.toLowerCase();
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();

  if (!path || isAssetUrl(lower)) return false;
  if (
    lower.includes("/share") ||
    lower.includes("/subscribe") ||
    lower.includes("/rss") ||
    lower.includes("#respond")
  ) {
    return false;
  }

  if (sourceDomain.includes("eventbrite.com")) {
    return /^\/e\/.+-tickets-\d+/i.test(path);
  }

  if (sourceDomain.includes("visitsaltlake.com")) {
    return /^\/event\/[^/]+\/[^/]+\/\d+\/?$/i.test(path);
  }

  if (
    sourceDomain.includes("facebook.com") ||
    sourceDomain.includes("instagram.com")
  ) {
    return false;
  }

  // Generic fallback for event detail pages.
  return (
    path.includes("/event/") ||
    /^\/events\/[^/]+\/[^/]+/.test(path) ||
    path.includes("/shows/") ||
    path.includes("/movie/")
  );
}

function extractEventUrlsFromJsonLd(
  jsonLd: unknown[],
  sourceDomain: string,
): string[] {
  const urls: string[] = [];

  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    const maybeType = record["@type"];
    const typeList = Array.isArray(maybeType) ? maybeType : [maybeType];
    const isEventType = typeList.some(
      (entry) => typeof entry === "string" && entry.toLowerCase() === "event",
    );

    if (isEventType && typeof record.url === "string") {
      urls.push(record.url);
    }

    Object.values(record).forEach(visit);
  };

  jsonLd.forEach(visit);

  return urls.filter((url) => looksLikeDetailUrl(url, sourceDomain));
}

function selectDetailLinks(params: {
  sourceDomain: string;
  pageUrl: string;
  linkCandidates: string[];
  jsonLd: unknown[];
  maxLinks?: number;
}): string[] {
  const maxLinks = params.maxLinks ?? 14;
  const sourceHost = getHostname(params.pageUrl);

  const fromJsonLd = extractEventUrlsFromJsonLd(
    params.jsonLd,
    params.sourceDomain,
  );
  const merged = [...fromJsonLd, ...params.linkCandidates];
  const deduped = Array.from(new Set(merged));

  const filtered = deduped.filter((url) => {
    const host = getHostname(url);
    if (!host || host !== sourceHost) return false;
    return looksLikeDetailUrl(url, params.sourceDomain);
  });

  return filtered.slice(0, maxLinks);
}

function dedupeAndRankEvents(params: {
  events: ExtractedEvent[];
  locationHint: string;
  dateRange: { startIso: string; endIso: string };
  rejectedPages: Array<z.infer<typeof rejectedPageSchema>>;
  sourceByUrl: Map<string, "jsonld" | "ai">;
}): ParsedEvent[] {
  const { events, locationHint, dateRange, rejectedPages, sourceByUrl } =
    params;

  const normalizedEvents = events
    .map((event) => {
      const startDate = toIsoDateOrNull(event.startDate);
      const endDate = toIsoDateOrNull(event.endDate ?? null);
      if (!startDate || !event.title || !event.sourceUrl) {
        rejectedPages.push({
          url: event.sourceUrl ?? "https://invalid.local/unknown",
          reason: "invalid_event_shape_or_date",
        });
        return null;
      }

      const extractionSource = sourceByUrl.get(event.sourceUrl) ?? "ai";
      const confidenceFloor = extractionSource === "jsonld" ? 0.35 : 0.6;
      if ((event.confidence ?? 0) < confidenceFloor) {
        rejectedPages.push({
          url: event.sourceUrl,
          reason: `below_confidence_floor_${extractionSource}`,
        });
        return null;
      }

      // Keep near-term recall high. Allow a wider window and let frontend/user filters narrow.
      const now = Date.now();
      const eventMs = new Date(startDate).getTime();
      const ninetyDaysFromNow = now + 90 * 24 * 60 * 60 * 1000;
      if (eventMs < now - 24 * 60 * 60 * 1000 || eventMs > ninetyDaysFromNow) {
        rejectedPages.push({
          url: event.sourceUrl,
          reason: "outside_90_day_window",
        });
        return null;
      }

      return {
        ...event,
        startDate,
        endDate,
      };
    })
    .filter((event): event is NonNullable<typeof event> => Boolean(event));

  const dedupedMap = new Map<string, (typeof normalizedEvents)[number]>();
  for (const event of normalizedEvents) {
    const key = [
      normalizeText(event.title),
      event.startDate.slice(0, 10),
      normalizeText(event.venue ?? ""),
      normalizeText(event.sourceUrl),
    ].join("|");

    const existing = dedupedMap.get(key);
    if (!existing || (event.confidence ?? 0) > (existing.confidence ?? 0)) {
      dedupedMap.set(key, event);
    }
  }

  return Array.from(dedupedMap.values())
    .sort((a, b) => {
      const dateSort =
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      if (dateSort !== 0) return dateSort;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    })
    .map((event, index) => ({
      id: `evt-${index}-${Buffer.from(event.sourceUrl).toString("base64url").slice(0, 10)}`,
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate ?? null,
      venue: event.venue ?? null,
      location: event.location ?? locationHint,
      sourceUrl: event.sourceUrl,
      imageUrl: event.imageUrl ?? null,
      primaryTag: event.primaryTag,
      tags: event.tags,
      confidence: event.confidence ?? 0.6,
    }));
}

export const searchEventsRouter = router({
  searchEvents: procedure.query(async ({ ctx }) => {
    const plan = await buildSearchPlanFromUser(ctx.auth.user.id);

    const candidateGroups = await Promise.all(
      plan.intentPrompts.map((prompt) =>
        retrieveCandidateUrls({
          prompt,
          maxResults: 15,
        }),
      ),
    );

    const mergedCandidates = candidateGroups.flat();
    const bestByCanonical = new Map<
      string,
      (typeof mergedCandidates)[number]
    >();
    for (const candidate of mergedCandidates) {
      const canonical = canonicalizeCandidateUrl(candidate.url);
      const existing = bestByCanonical.get(canonical);
      if (!existing || (candidate.score ?? 0) > (existing.score ?? 0)) {
        bestByCanonical.set(canonical, { ...candidate, url: canonical });
      }
    }

    const domainCap = 6;
    const domainCounts = new Map<string, number>();

    const candidates = Array.from(bestByCanonical.values())
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .filter((candidate) => {
        const host = getHostname(candidate.url);
        if (!host) return false;

        // Guard eventbrite to local region style paths.
        if (
          host.includes("eventbrite.com") &&
          !candidate.url.includes("/ut--salt-lake-city")
        ) {
          return false;
        }

        const count = domainCounts.get(host) ?? 0;
        if (count >= domainCap) return false;
        domainCounts.set(host, count + 1);
        return true;
      })
      .slice(0, 40);

    const taggedCandidates = candidates.map((candidate, index) => {
      const tagText = `${candidate.title} ${candidate.snippet}`;
      const { primaryTag, tags } = inferTagsFromText(tagText);

      return {
        id: `cand-${index}-${Buffer.from(candidate.url).toString("base64url").slice(0, 10)}`,
        title: candidate.title,
        sourceUrl: candidate.url,
        snippet: candidate.snippet,
        score: candidate.score,
        primaryTag,
        tags,
      };
    });

    const urls = taggedCandidates.map((c) => c.sourceUrl).slice(0, 16);
    const allEvents: ExtractedEvent[] = [];
    const rejectedPages: Array<z.infer<typeof rejectedPageSchema>> = [];
    const extractionPages: Array<z.infer<typeof extractedPagePreviewSchema>> =
      [];
    let aiQuotaExceeded = false;
    const seenAiUrls = new Set<string>();
    let jsonLdEventsFound = 0;
    let aiEventsFound = 0;
    let pagesProcessedByAi = 0;
    let pagesUsingJsonLd = 0;
    let pagesUsingAi = 0;
    const sourceByUrl = new Map<string, "jsonld" | "ai">();

    for (const url of urls) {
      const pageResult = await fetchPageMetadataDetailed(url);
      if (!pageResult.ok) {
        const failed = pageResult as Extract<FetchPageResult, { ok: false }>;
        rejectedPages.push({
          url,
          reason: `fetch_failed_${failed.reason}${failed.status ? `_status_${failed.status}` : ""}`,
        });
        continue;
      }
      const page = pageResult.page;

      const pagesForAi = [page];

      if (
        isLikelyHubPage({
          url: page.finalUrl,
          title: page.title,
          sourceDomain: page.sourceDomain,
          linkCandidates: page.linkCandidates,
        })
      ) {
        const detailLinks = selectDetailLinks({
          sourceDomain: page.sourceDomain,
          pageUrl: page.finalUrl,
          linkCandidates: page.linkCandidates,
          jsonLd: page.jsonLd,
          maxLinks: 20,
        });

        if (detailLinks.length > 0) {
          pagesForAi.length = 0;
          for (const detailUrl of detailLinks) {
            const detailPageResult = await fetchPageMetadataDetailed(detailUrl);
            if (!detailPageResult.ok) {
              const failed = detailPageResult as Extract<
                FetchPageResult,
                { ok: false }
              >;
              rejectedPages.push({
                url: detailUrl,
                reason: `detail_fetch_failed_${failed.reason}${failed.status ? `_status_${failed.status}` : ""}`,
              });
              continue;
            }
            pagesForAi.push(detailPageResult.page);
          }
        } else {
          // Fallback: let AI attempt to parse concrete event rows from hub payload.
          rejectedPages.push({
            url: page.finalUrl,
            reason: "hub_no_detail_links_using_hub_fallback",
          });
        }
      }

      for (const pageForAi of pagesForAi) {
        if (seenAiUrls.has(pageForAi.finalUrl)) continue;
        seenAiUrls.add(pageForAi.finalUrl);
        pagesProcessedByAi += 1;

        extractionPages.push({
          url: pageForAi.finalUrl,
          title: pageForAi.title,
          sourceDomain: pageForAi.sourceDomain,
          publishedDate: null,
          image: pageForAi.ogImage,
          contentPreview: pageForAi.cleanText.slice(0, 500),
          contentLength: pageForAi.cleanText.length,
        });

        let events: ExtractedEvent[] = [];
        try {
          // High-confidence fast path: many event sites expose Event JSON-LD.
          const jsonLdEvents = extractEventsFromJsonLd({
            page: pageForAi,
            locationHint: plan.location,
          });

          if (jsonLdEvents.length > 0) {
            events = jsonLdEvents;
            pagesUsingJsonLd += 1;
            jsonLdEventsFound += jsonLdEvents.length;
            for (const event of jsonLdEvents) {
              sourceByUrl.set(event.sourceUrl, "jsonld");
            }
          } else {
            pagesUsingAi += 1;
            events = await extractEventsFromPageWithAI({
              page: pageForAi,
              locationHint: plan.location,
              rangeStartIso: plan.dateRange.startIso,
              rangeEndIso: plan.dateRange.endIso,
            });
            aiEventsFound += events.length;
            for (const event of events) {
              sourceByUrl.set(event.sourceUrl, "ai");
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          if (
            message.includes("429") ||
            message.toLowerCase().includes("quota")
          ) {
            aiQuotaExceeded = true;
            rejectedPages.push({
              url: pageForAi.finalUrl,
              reason: "ai_quota_exceeded",
            });
            break;
          }
          rejectedPages.push({
            url: pageForAi.finalUrl,
            reason: "ai_extraction_failed",
          });
          continue;
        }

        if (events.length === 0) {
          rejectedPages.push({
            url: pageForAi.finalUrl,
            reason: "no_events_extracted",
          });
        } else {
          const validatedEvents = events
            .map((event) => extractedEventSchema.safeParse(event))
            .filter(
              (
                parsed,
              ): parsed is {
                success: true;
                data: z.infer<typeof extractedEventSchema>;
              } => parsed.success,
            )
            .map((parsed) => ({
              ...parsed.data,
              imageUrl: parsed.data.imageUrl ?? pageForAi.ogImage ?? null,
            }));

          if (validatedEvents.length === 0) {
            rejectedPages.push({
              url: pageForAi.finalUrl,
              reason: "ai_events_failed_shape_validation",
            });
          }

          allEvents.push(...validatedEvents);
        }
      }

      if (aiQuotaExceeded) break;
    }

    const parsedEvents = dedupeAndRankEvents({
      events: allEvents,
      locationHint: plan.location,
      dateRange: plan.dateRange,
      rejectedPages,
      sourceByUrl,
    });

    return searchEventsResponseSchema.parse({
      stage: aiQuotaExceeded ? "candidate" : "event",
      queryPlan: plan,
      candidateCount: taggedCandidates.length,
      eventCount: parsedEvents.length,
      candidates: taggedCandidates,
      parsedEvents,
      rejectedPages,
      extraction: {
        requestedUrls: urls.length,
        extractedPages: extractionPages.length,
        pages: extractionPages,
        debug: {
          jsonLdEventsFound,
          aiEventsFound,
          pagesProcessedByAi,
          pagesUsingJsonLd,
          pagesUsingAi,
        },
      },
    });
  }),
});
