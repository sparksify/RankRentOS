/**
 * Competitor content-depth measurement — V0's "how many words are on the
 * page" check. HTML→text extraction is pure; fetching is injected so tests
 * run on fixtures and actions supply real fetch.
 */

export function wordCount(html: string): number {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  return text.split(" ").filter((w) => w.length > 2).length;
}

export interface ContentDepthResult {
  pages: { link: string; words: number | null }[];
  avgWords: number | null;
}

export async function contentDepth(
  links: string[],
  fetchFn: typeof fetch,
  { max = 3, timeoutMs = 8000 }: { max?: number; timeoutMs?: number } = {},
): Promise<ContentDepthResult> {
  const targets = links.filter(Boolean).slice(0, max);
  const pages: { link: string; words: number | null }[] = [];
  for (const link of targets) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetchFn(link, {
        signal: ctrl.signal,
        headers: { "user-agent": "Mozilla/5.0 (compatible; market-research)" },
        redirect: "follow",
      });
      clearTimeout(timer);
      if (!res.ok) {
        pages.push({ link, words: null });
        continue;
      }
      pages.push({ link, words: wordCount(await res.text()) });
    } catch {
      pages.push({ link, words: null });
    }
  }
  const valid = pages
    .map((p) => p.words)
    .filter((w): w is number => w !== null);
  return {
    pages,
    avgWords: valid.length
      ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
      : null,
  };
}
