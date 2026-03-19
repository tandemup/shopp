export type Store = {
  id: string;

  name: string;
  brand?: string;

  address?: string;
  city?: string;
  province?: string;

  lat?: number;
  lng?: number;

  isFavorite?: boolean;

  createdAt?: number;
  updatedAt?: number;
};
