# Shopp Data Model

## ShoppingList

    type ShoppingList = {
      id: string
      name: string
      storeId?: string
      status: "active" | "archived"
      createdAt: number
      updatedAt: number
    }

## ListItem

    type ListItem = {
      id: string
      listId: string
      name: string
      quantity: number
      unit?: string
      checked: boolean
      category?: string
      productId?: string
      notes?: string
    }

## Store

    type Store = {
      id: string
      name: string
      city?: string
      zipcode?: string
      address?: string
      location?: {
        lat: number
        lng: number
      }
    }

## Product

    type Product = {
      id: string
      name: string
      brand?: string
      barcode?: string
      category?: string
    }

## PriceRecord

    type PriceRecord = {
      id: string
      productId: string
      storeId: string
      price: number
      currency: string
    }
