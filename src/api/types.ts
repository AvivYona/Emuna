export interface Author {
  _id: string;
  name: string;
}

export interface Quote {
  _id: string;
  quote: string;
  author: Author;
}

export interface Background {
  _id: string;
  imageUrl: string;
  filename?: string;
  contentType?: string;
  thumbnailUrl?: string;
  dominantColor?: string;
  displayName?: string;
}

export interface ApiResponse<T> {
  data: T;
}
