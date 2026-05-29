export type PageMetadata = {
  sourceUrl: string;
  finalUrl: string;
  sourceDomain: string;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  headings: {
    h1: string[];
    h2: string[];
  };
  jsonLd: unknown[];
  linkCandidates: string[];
  eventLikeSnippets: string[];
  cleanText: string;
  rawHtml: string;
};

export type FetchPageFailureReason =
  | "timeout"
  | "http_error"
  | "network_error"
  | "empty_body"
  | "invalid_content_type";

export type FetchPageResult =
  | { ok: true; page: PageMetadata }
  | {
      ok: false;
      reason: FetchPageFailureReason;
      detail: string;
      status?: number;
    };

function firstMetaContent(html: string, names: string[]): string | null {
  for (const name of names) {
    const regex = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    );
    const match = html.match(regex);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

function normalizeMaybeUrl(value: string | null, baseUrl: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function firstTagText(html: string, tag: string): string | null {
  const match = html.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"),
  );
  if (!match?.[1]) return null;
  return match[1].replace(/\s+/g, " ").trim() || null;
}

function allTagText(html: string, tag: string, max = 12): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const values: string[] = [];
  const matches = Array.from(html.matchAll(regex));
  for (const match of matches) {
    const text = (match[1] ?? "").replace(/\s+/g, " ").trim();
    if (text) values.push(text);
    if (values.length >= max) break;
  }
  return values;
}

function extractJsonLd(html: string): unknown[] {
  const results: unknown[] = [];
  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const matches = Array.from(html.matchAll(regex));
  for (const match of matches) {
    const raw = (match[1] ?? "").trim();
    if (!raw) continue;
    try {
      results.push(JSON.parse(raw));
    } catch {
      // ignore invalid JSON-LD blobs
    }
  }
  return results;
}

function cleanHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAbsoluteLinks(
  html: string,
  baseUrl: string,
  max = 40,
): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  const hrefRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  const matches = Array.from(html.matchAll(hrefRegex));
  for (const match of matches) {
    const href = match[1];
    if (!href) continue;
    try {
      const absolute = new URL(href, baseUrl).toString();
      const lower = absolute.toLowerCase();
      if (!/^https?:\/\//.test(lower)) continue;
      if (lower.includes("/share") || lower.includes("/subscribe")) continue;
      if (seen.has(absolute)) continue;
      seen.add(absolute);
      links.push(absolute);
      if (links.length >= max) break;
    } catch {
      // ignore invalid URLs
    }
  }
  return links;
}

function extractEventLikeSnippets(text: string, max = 25): string[] {
  const lines = text.split(/(?<=\.)\s+|\n/);
  const pattern =
    /\b(event|events|festival|concert|show|tickets|rsvp|register|date|time|pm|am|venue|location|saturday|sunday)\b/i;
  const matches: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 20) continue;
    if (!pattern.test(trimmed)) continue;
    matches.push(trimmed.slice(0, 300));
    if (matches.length >= max) break;
  }
  return matches;
}

export async function fetchPageMetadata(
  url: string,
): Promise<PageMetadata | null> {
  const result = await fetchPageMetadataDetailed(url);
  return result.ok ? result.page : null;
}

export async function fetchPageMetadataDetailed(
  url: string,
): Promise<FetchPageResult> {
  const userAgents = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (compatible; NearvanaBot/1.0; +https://nearvana.app)",
  ];

  let lastFailure: Exclude<FetchPageResult, { ok: true; page: PageMetadata }> =
    {
      ok: false,
      reason: "network_error",
      detail: "No attempt performed",
    };

  for (const userAgent of userAgents) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml",
        },
      });

      const finalUrl = res.url || url;
      const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
      const rawHtml = await res.text();

      if (!rawHtml || rawHtml.trim().length === 0) {
        lastFailure = {
          ok: false,
          reason: "empty_body",
          detail: `Empty body with status ${res.status}`,
          status: res.status,
        };
        continue;
      }

      if (!contentType.includes("text/html")) {
        lastFailure = {
          ok: false,
          reason: "invalid_content_type",
          detail: `Unexpected content-type: ${contentType || "unknown"}`,
          status: res.status,
        };
        continue;
      }

      // Some sites return useful HTML on 4xx/5xx due to bot gates.
      if (!res.ok && rawHtml.length < 500) {
        lastFailure = {
          ok: false,
          reason: "http_error",
          detail: `HTTP ${res.status}`,
          status: res.status,
        };
        continue;
      }

      const cleanText = cleanHtmlToText(rawHtml);
      const sourceDomain = (() => {
        try {
          return new URL(finalUrl).hostname.replace(/^www\./, "").toLowerCase();
        } catch {
          return "unknown";
        }
      })();

      return {
        ok: true,
        page: {
          sourceUrl: url,
          finalUrl,
          sourceDomain,
          title: firstTagText(rawHtml, "title"),
          metaDescription: firstMetaContent(rawHtml, [
            "description",
            "og:description",
          ]),
          canonicalUrl: (() => {
            const match = rawHtml.match(
              /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i,
            );
            return match?.[1]?.trim() || null;
          })(),
          ogTitle: firstMetaContent(rawHtml, ["og:title"]),
          ogDescription: firstMetaContent(rawHtml, ["og:description"]),
      ogImage: normalizeMaybeUrl(firstMetaContent(rawHtml, ["og:image"]), finalUrl),
          headings: {
            h1: allTagText(rawHtml, "h1", 6),
            h2: allTagText(rawHtml, "h2", 12),
          },
          jsonLd: extractJsonLd(rawHtml),
          linkCandidates: extractAbsoluteLinks(rawHtml, finalUrl, 40),
          eventLikeSnippets: extractEventLikeSnippets(cleanText, 25),
          cleanText,
          rawHtml,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const reason: FetchPageFailureReason = message
        .toLowerCase()
        .includes("aborted")
        ? "timeout"
        : "network_error";
      lastFailure = {
        ok: false,
        reason,
        detail: message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return lastFailure;
}
