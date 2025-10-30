import { fetchJson } from "./client";
import { Quote } from "./types";

export async function getQuotes(): Promise<Quote[]> {
  return fetchJson<Quote[]>("/quotes");
}

export async function getRandomQuote(): Promise<Quote | null> {
  try {
    return await fetchJson<Quote>("/quotes/random");
  } catch (error) {
    console.warn("Failed to fetch random quote", error);
    return null;
  }
}
