import { fetchJson } from "./client";
import { Quote } from "./types";

export async function getQuotesByAuthorIds(
  authorIds: string[]
): Promise<Quote[]> {
  const query = authorIds.length ? `?authors=${authorIds.join(",")}` : "";
  return fetchJson<Quote[]>(`/quotes${query}`);
}

export async function getRandomQuote(
  authorIds: string[]
): Promise<Quote | null> {
  const quotes = await getQuotesByAuthorIds(authorIds);
  if (!quotes.length) {
    return null;
  }
  return quotes[Math.floor(Math.random() * quotes.length)];
}
