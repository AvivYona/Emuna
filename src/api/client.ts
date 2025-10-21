export const BASE_URL = "http://localhost:3000";
// export const BASE_URL =
//   "https://ng52wotdcb.execute-api.il-central-1.amazonaws.com";

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`JSON parsing error: ${error}`);
  }
}

export async function fetchJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }

  return parseJson<T>(response);
}

export function buildImageUrl(path: string) {
  if (path.startsWith("http")) {
    return path;
  }
  return `${BASE_URL}${path}`;
}
