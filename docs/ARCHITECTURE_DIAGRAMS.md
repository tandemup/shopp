# ARCHITECTURE_DIAGRAMS.md

This document contains visual diagrams describing the architecture of
the **Shopp** system.

------------------------------------------------------------------------

# 1. System Architecture

               ┌─────────────────────┐
               │      Mobile App     │
               │  React Native + Expo│
               └──────────┬──────────┘
                          │
                          │ Hooks
                          ▼
                 ┌─────────────────┐
                 │  Feature Layer  │
                 │  Business Logic │
                 └─────────┬───────┘
                           │
                           │ Services
                           ▼
                 ┌─────────────────┐
                 │ Convex Backend  │
                 │ Queries/Mutations│
                 └─────────┬───────┘
                           │
                           ▼
                   ┌─────────────┐
                   │ Convex DB   │
                   └─────────────┘

------------------------------------------------------------------------

# 2. Frontend Architecture

    app/
      Screens

       ↓

    components/
      UI components

       ↓

    hooks/
      data access

       ↓

    features/
      business logic

       ↓

    services/
      infrastructure

------------------------------------------------------------------------

# 3. Data Flow

    User Action
        │
        ▼
    Screen Component
        │
        ▼
    Custom Hook
        │
        ▼
    Convex Mutation
        │
        ▼
    Database Update
        │
        ▼
    Reactive Query Refresh
        │
        ▼
    UI Re-render

------------------------------------------------------------------------

# 4. Offline Strategy

              App Query
                 │
                 ▼
           Convex Backend
                 │
         ┌───────┴────────┐
         │                │
         ▼                ▼
     Online Data     Offline Cache
                           │
                           ▼
                        Seeds
                        JSON

------------------------------------------------------------------------

# 5. Navigation Architecture

    Stack Navigator
    │
    ├─ Tabs
    │   ├─ Lists
    │   ├─ Stores
    │   ├─ Barcode
    │   └─ Settings
    │
    └─ Modals
        ├─ Create List
        ├─ Add Item
        ├─ Edit Item
        └─ Select Store

------------------------------------------------------------------------

# 6. Domain Architecture

    Domains

    Lists
     │
     └── ListItems

    Stores
     │
     └── Purchases
          │
          └── PurchaseItems

    Products
     │
     └── Pricing

------------------------------------------------------------------------

# 7. Development Flow

    Feature Idea
        │
        ▼
    Design Data Model
        │
        ▼
    Create Convex Schema
        │
        ▼
    Implement Backend
        │
        ▼
    Create Hooks
        │
        ▼
    Create Components
        │
        ▼
    Create Screens
