export interface Store {
  id: string;
  name: string;
  city?: string;
  provincia?: string;
  address?: string;
  zipcode?: number;
  favorite?: boolean;
  location?: {
    lat: number;
    lng: number;
    source?: string;
  };
}
