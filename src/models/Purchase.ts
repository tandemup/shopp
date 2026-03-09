export interface Purchase {
  id: string
  productId?: string
  name: string
  price: number
  quantity: number
  storeId?: string
  date: number
}