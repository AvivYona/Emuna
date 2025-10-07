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
  title?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  dominantColor?: string;
}

export interface ApiResponse<T> {
  data: T;
}
