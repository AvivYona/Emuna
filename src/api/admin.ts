import { BASE_URL } from "./client";
import { Quote, Background, Author } from "./types";

type AdminVerifyResponse = {
  valid: boolean;
};

export type AdminQuotePayload = {
  quote: string;
  authorId: string;
};

export type AdminBackgroundPayload = {
  filename: string;
  imageUrl?: string;
  dominantColor?: string;
  thumbnailUrl?: string;
  contentType?: string;
};

export type AdminBackgroundFile = {
  uri: string;
  name: string;
  type: string;
};

export type AdminAuthorPayload = {
  name: string;
};

function withAdminHeaders(secret: string, init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers ?? {});
  headers.set("x-api-password", secret);

  return {
    ...init,
    headers,
  };
}

async function adminRequest<T = unknown>(
  path: string,
  secret: string,
  init?: RequestInit
): Promise<T> {
  const request = withAdminHeaders(secret, init);
  const response = await fetch(`${BASE_URL}${path}`, request);

  if (!response.ok) {
    throw new Error(`Admin request failed (${response.status})`);
  }

  const contentLength = response.headers.get("content-length");
  if (response.status === 204 || contentLength === "0") {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Failed to parse admin response: ${error}`);
  }
}

export async function verifyAdminPassphrase(
  password: string
): Promise<boolean> {
  const response = await fetch(`${BASE_URL}/admin/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    throw new Error(`Verification failed (${response.status})`);
  }

  const data = (await response.json()) as AdminVerifyResponse;
  return Boolean(data?.valid);
}

export async function fetchAdminQuotes(secret: string): Promise<Quote[]> {
  const data = await adminRequest<Quote[]>("/quotes", secret);
  return Array.isArray(data) ? data : [];
}

export async function createAdminQuote(
  secret: string,
  payload: AdminQuotePayload
): Promise<Quote> {
  return adminRequest<Quote>("/quotes", secret, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateAdminQuote(
  secret: string,
  id: string,
  payload: AdminQuotePayload
): Promise<Quote> {
  return adminRequest<Quote>(`/quotes/${id}`, secret, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminQuote(
  secret: string,
  id: string
): Promise<void> {
  await adminRequest(`/quotes/${id}`, secret, {
    method: "DELETE",
  });
}

export async function fetchAdminBackgrounds(
  secret: string
): Promise<Background[]> {
  const data = await adminRequest<Background[]>("/backgrounds", secret);
  return Array.isArray(data) ? data : [];
}

export async function createAdminBackground(
  secret: string,
  payload: AdminBackgroundPayload,
  file?: AdminBackgroundFile
): Promise<Background> {
  if (file) {
    const formData = new FormData();
    formData.append(
      "file",
      {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any
    );

    formData.append("filename", payload.filename);

    if (payload.contentType) {
      formData.append("contentType", payload.contentType);
    }
    if (payload.thumbnailUrl) {
      formData.append("thumbnailUrl", payload.thumbnailUrl);
    }
    if (payload.dominantColor) {
      formData.append("dominantColor", payload.dominantColor);
    }
    if (payload.imageUrl) {
      formData.append("imageUrl", payload.imageUrl);
    }

    return adminRequest<Background>("/backgrounds", secret, {
      method: "POST",
      body: formData,
    });
  }

  return adminRequest<Background>("/backgrounds", secret, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateAdminBackground(
  secret: string,
  id: string,
  payload: AdminBackgroundPayload
): Promise<Background> {
  return adminRequest<Background>(`/backgrounds/${id}`, secret, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminBackground(
  secret: string,
  id: string
): Promise<void> {
  await adminRequest(`/backgrounds/${id}`, secret, {
    method: "DELETE",
  });
}

export async function fetchAdminAuthors(secret: string): Promise<Author[]> {
  const data = await adminRequest<Author[]>("/authors", secret);
  return Array.isArray(data) ? data : [];
}

export async function createAdminAuthor(
  secret: string,
  payload: AdminAuthorPayload
): Promise<Author> {
  return adminRequest<Author>("/authors", secret, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateAdminAuthor(
  secret: string,
  id: string,
  payload: AdminAuthorPayload
): Promise<Author> {
  return adminRequest<Author>(`/authors/${id}`, secret, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminAuthor(secret: string, id: string): Promise<void> {
  await adminRequest(`/authors/${id}`, secret, {
    method: "DELETE",
  });
}
