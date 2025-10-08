import { fetchJson } from './client';
import { Quote } from './types';
import { fallbackQuotes } from '../utils/fallbackData';

export async function getQuotesByAuthorIds(authorIds: string[]): Promise<Quote[]> {
  try {
    const query = authorIds.length ? `?authors=${authorIds.join(',')}` : '';
    const data = await fetchJson<Quote[]>(`/quotes${query}`);
    if (!Array.isArray(data) || data.length === 0) {
      return fallbackQuotes;
    }
    return data;
  } catch (error) {
    console.warn('Error fetching quotes, using fallback data', error);
    return fallbackQuotes;
  }
}

export async function getRandomQuote(authorIds: string[]): Promise<Quote> {
  const quotes = await getQuotesByAuthorIds(authorIds);
  return quotes[Math.floor(Math.random() * quotes.length)];
}
