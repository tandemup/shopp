export type GeoPoint = {
  lat: number;
  lng: number;
  source?: string;
};

export type StoreInput = {
  name: string;
  city?: string;
  provincia?: string;
  address: string;
  zipcode?: string | number;
  location?: GeoPoint;
  favorite?: boolean;
  isActive?: boolean;
};
