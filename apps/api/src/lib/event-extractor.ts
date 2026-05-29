import OpenAI from "openai";
import { z } from "zod";
import type { PageMetadata } from "./page-fetch";

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

export const extractedEventSchema = z.object({
  title: z.string(),
  // Keep date fields flexible from model output; normalize later.
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  sourceUrl: z.string(),
  imageUrl: z.string().nullable().optional(),
  primaryTag: eventTagEnum,
  tags: z.array(eventTagEnum).min(1).max(5),
  confidence: z.number().min(0).max(1).default(0.6),
});

export type ExtractedEvent = z.infer<typeof extractedEventSchema>;

const aiResponseSchema = z.object({
  events: z.array(extractedEventSchema),
});

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

function extractEmbeddedEventSignals(
  rawHtml: string,
  maxBlocks = 10,
): string[] {
  const signals: string[] = [];
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const keywordRegex =
    /\b(event|startdate|enddate|eventdate|location|venue|ticket|tickets|offer|performer|door)\b/i;
  let totalChars = 0;
  const maxTotalChars = 12000;

  const matches = Array.from(rawHtml.matchAll(scriptRegex));
  for (const match of matches) {
    const scriptBody = (match[1] ?? "").trim();
    if (scriptBody.length < 40) continue;
    if (!keywordRegex.test(scriptBody)) continue;

    const compact = scriptBody.replace(/\s+/g, " ").slice(0, 1400);
    if (!compact) continue;

    signals.push(compact);
    totalChars += compact.length;
    if (signals.length >= maxBlocks || totalChars >= maxTotalChars) break;
  }

  return signals;
}

export async function extractEventsFromPageWithAI(params: {
  page: PageMetadata;
  locationHint: string;
  rangeStartIso: string;
  rangeEndIso: string;
  strategy?: "default" | "rescue";
}): Promise<ExtractedEvent[]> {
  const client = getOpenAIClient();
  const page = params.page;
  const strategy = params.strategy ?? "default";
  const embeddedEventSignals = extractEmbeddedEventSignals(page.rawHtml, 10);
  const strategyGuidance =
    strategy === "rescue"
      ? `Rescue mode: this page likely contains events but structured extraction failed once.
- Use eventLikeSnippets, headings, embeddedEventSignals, and metadata together.
- Accept dates in natural-language form if clearly tied to an event title.
- If a listing contains multiple concrete event rows, extract each row as a separate event.
- Prefer precision over hallucination; only extract when title + date/time evidence exists.`
      : `Default mode:
- If page is a listing/hub, extract each concrete event row/card that has a specific title + explicit date/time.
- Extract as many concrete events as you can find in the page payload.`;

  const prompt = `
You extract EVENT OBJECTS from structured webpage metadata.

Rules:
- Return strict JSON object with key: "events".
- Extract only real event details from the page metadata.
- Prioritize JSON-LD Event objects when present.
- Ignore generic category pages, listing hubs, navigation links, and image asset links.
- Do not hallucinate unknown fields; use null if missing.
- Prefer location near: ${params.locationHint}.
- primaryTag must be one of allowed tags and included in tags.
- sourceUrl must be the canonical event/detail URL when possible.
- ${strategyGuidance}
- If no concrete events are found, return {"events":[]}.

Allowed tags:
music, food-drink, nightlife, arts-culture, comedy, sports, family, community, outdoors, markets-fairs, workshops, seasonal

Page metadata JSON:
${JSON.stringify(
  {
    sourceUrl: page.sourceUrl,
    finalUrl: page.finalUrl,
    sourceDomain: page.sourceDomain,
    title: page.title,
    metaDescription: page.metaDescription,
    canonicalUrl: page.canonicalUrl,
    ogTitle: page.ogTitle,
    ogDescription: page.ogDescription,
    ogImage: page.ogImage,
    headings: page.headings,
    jsonLd: page.jsonLd,
    eventLikeSnippets: page.eventLikeSnippets,
    embeddedEventSignals,
    linkCandidates: page.linkCandidates.slice(0, 20),
    cleanText: page.cleanText.slice(0, 12000),
  },
  null,
  2,
)}
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are a strict event data extractor." },
      { role: "user", content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? `{"events":[]}`;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const validated = aiResponseSchema.safeParse(parsed);
  if (!validated.success) return [];

  return validated.data.events;
}
