import { fetchJson } from './client';
import { Author } from './types';
import { fallbackAuthors } from '../utils/fallbackData';

export async function getAuthors(): Promise<Author[]> {
  try {
    const data = await fetchJson<Author[]>('/authors');
    if (!Array.isArray(data) || data.length === 0) {
      return fallbackAuthors;
    }
    return data;
  } catch (error) {
    console.warn('שגיאה בשליפת מחברים, שימוש בנתוני ברירת מחדל', error);
    return fallbackAuthors;
  }
}
