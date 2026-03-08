# CONVEX_SCHEMA_FULL.md

## Overview

This document defines the full Convex database schema for the Shopp
application.

Convex manages:

-   lists
-   list items
-   stores
-   products
-   pricing
-   purchases
-   product learning

------------------------------------------------------------------------

# Tables

## lists

    {
      name: string,
      storeId?: Id<"stores">,
      status: "active" | "archived",
      createdAt: number,
      updatedAt: number
    }

------------------------------------------------------------------------

## listItems

    {
      listId: Id<"lists">,
      name: string,
      quantity: number,
      unit?: string,
      checked: boolean,
      category?: string,
      productId?: Id<"products">,
      notes?: string,
      createdAt: number,
      updatedAt: number
    }

------------------------------------------------------------------------

## stores

    {
      name: string,
      city?: string,
      province?: string,
      zipcode?: string,
      address?: string,
      location?: {
        lat: number,
        lng: number
      },
      isFavorite?: boolean,
      createdAt: number,
      updatedAt: number
    }

------------------------------------------------------------------------

## products

    {
      name: string,
      brand?: string,
      barcode?: string,
      category?: string,
      defaultUnit?: string,
      aliases?: string[],
      createdAt: number,
      updatedAt: number
    }

------------------------------------------------------------------------

## pricing

    {
      productId: Id<"products">,
      storeId: Id<"stores">,
      price: number,
      currency: string,
      promoType?: string,
      validFrom?: number,
      validTo?: number,
      createdAt: number
    }

------------------------------------------------------------------------

## purchases

    {
      storeId?: Id<"stores">,
      listId?: Id<"lists">,
      total?: number,
      currency: string,
      purchasedAt: number,
      createdAt: number
    }

------------------------------------------------------------------------

## purchaseItems

    {
      purchaseId: Id<"purchases">,
      productId?: Id<"products">,
      name: string,
      quantity: number,
      unit?: string,
      paidPrice?: number
    }
