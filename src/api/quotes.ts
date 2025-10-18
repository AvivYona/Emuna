import { fetchJson } from "./client";
import { Quote } from "./types";

export async function getQuotes(): Promise<Quote[]> {
  return fetchJson<Quote[]>("/quotes");
}

export async function getRandomQuote(): Promise<Quote | null> {
  const quotes = await getQuotes();
  if (!quotes.length) {
    return null;
  }
  return quotes[Math.floor(Math.random() * quotes.length)];
}
