# Shopp Architecture Documentation

## Overview

Shopp is a mobile‑first shopping list application built with: - React
Native - Expo Router - Convex backend - TypeScript - Optional PWA
support

The system is designed to scale while remaining offline‑friendly.

------------------------------------------------------------------------

# 1. High Level Architecture

    shopp/
    ├─ app/                      # Expo Router screens
    ├─ src/                      # application logic
    ├─ convex/                   # backend
    ├─ data/                     # seed JSON
    ├─ assets/
    └─ docs/

Separation of concerns:

  Layer        Responsibility
  ------------ ----------------------
  app          routing and screens
  components   UI rendering
  features     business logic
  hooks        reusable data access
  services     infrastructure
  store        UI state
  convex       backend
  data         seed datasets

------------------------------------------------------------------------

# 2. Project Structure

    app/
      (tabs)/
      (modals)/
      list/[id].tsx

    src/
      components/
      features/
      hooks/
      services/
      store/
      types/
      constants/

    convex/
      schema.ts
      lists.ts
      listItems.ts
      stores.ts
      purchases.ts
      products.ts
      pricing.ts

------------------------------------------------------------------------

# 3. Core Domains

The system is divided into these domains:

-   Lists
-   ListItems
-   Stores
-   Products
-   Pricing
-   Purchases
-   Settings
-   ProductLearning

------------------------------------------------------------------------

# 4. Data Flow

    UI Screen
       ↓
    Hook
       ↓
    Service
       ↓
    Convex Query / Mutation
       ↓
    Database

Example:

    app/list/[id].tsx
       ↓
    useListItems()
       ↓
    convex query
       ↓
    render ItemRow

------------------------------------------------------------------------

# 5. Offline Strategy

Level 1: - local JSON seeds - local cache

Level 2: - mutation queue

Level 3: - conflict resolution

Initial implementation can operate with **Level 1**.

------------------------------------------------------------------------

# 6. Navigation

Tabs:

-   Lists
-   Stores
-   Barcode
-   Settings

Stack screens:

-   list/\[id\]
-   purchase/\[id\]
-   product/\[id\]

Modals:

-   create-list
-   add-item
-   edit-item
-   select-store
