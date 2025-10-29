import { fetchJson } from "./client";
import { Author } from "./types";

export async function getAuthors(): Promise<Author[]> {
  return fetchJson<Author[]>("/authors");
}
