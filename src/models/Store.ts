export interface Store {
  id: string
  name: string
  city?: string
  province?: string
  location?: {
    lat: number
    lng: number
  }
  isFavorite?: boolean
}