import { z } from "zod";
import { tavily } from "tavily";

const tavilyResultSchema = z.object({
  url: z.string(),
  title: z.string().default("Untitled"),
  content: z.string().optional().default(""),
  score: z.number().optional(),
});

export const candidateUrlSchema = z.object({
  url: z.string(),
  title: z.string(),
  snippet: z.string(),
  score: z.number().nullable(),
});

export type CandidateUrl = z.infer<typeof candidateUrlSchema>;

const MAX_TAVILY_QUERY_LENGTH = 400;

function toTavilyQuery(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_TAVILY_QUERY_LENGTH) return normalized;
  return normalized.slice(0, MAX_TAVILY_QUERY_LENGTH);
}

function getTavilyClient() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing TAVILY_API_KEY in apps/api/.env");
  }
  return tavily({ apiKey });
}

export async function retrieveCandidateUrls(params: {
  prompt: string;
  maxResults?: number;
}): Promise<CandidateUrl[]> {
  const client = getTavilyClient();
  const query = toTavilyQuery(params.prompt);

  const response = await client.search(query, {
    maxResults: params.maxResults ?? 12,
    // Keep this broad for v1 retrieval
    searchDepth: "basic",
    includeAnswer: false,
    includeRawContent: false,
    topic: "general",
  });

  const rawResults = Array.isArray(response.results) ? response.results : [];

  const normalized = rawResults
    .map((item) => tavilyResultSchema.safeParse(item))
    .filter(
      (p): p is { success: true; data: z.infer<typeof tavilyResultSchema> } =>
        p.success,
    )
    .map(({ data }) => ({
      url: data.url,
      title: data.title?.trim() || "Untitled",
      snippet: data.content?.trim() || "",
      score: typeof data.score === "number" ? data.score : null,
    }));

  // De-dupe by URL
  const deduped = Array.from(
    new Map(normalized.map((r) => [r.url, r])).values(),
  );

  return deduped;
}
