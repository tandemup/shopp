# Shopp Development Guide

## Purpose

This guide defines development conventions, workflows, and architectural
rules for the **Shopp** application.

Goals:

-   keep architecture consistent
-   avoid technical debt
-   simplify onboarding
-   support scaling of the codebase

------------------------------------------------------------------------

# 1. Technology Stack

Core technologies used in Shopp:

  Layer        Technology
  ------------ --------------------------
  Frontend     React Native
  Routing      Expo Router
  Backend      Convex
  Language     TypeScript
  State (UI)   Zustand
  Offline      JSON seeds + local cache

------------------------------------------------------------------------

# 2. Project Structure

    shopp/
    ├─ app/              # Expo Router screens
    ├─ src/
    │  ├─ components/
    │  ├─ features/
    │  ├─ hooks/
    │  ├─ services/
    │  ├─ store/
    │  ├─ lib/
    │  ├─ types/
    │  └─ constants/
    ├─ convex/
    ├─ data/
    ├─ assets/
    └─ docs/

### Rules

-   **app/** contains only screens and navigation
-   **components/** contains reusable UI elements
-   **features/** contains domain logic
-   **hooks/** expose feature logic to UI
-   **services/** contain infrastructure logic
-   **store/** contains Zustand stores
-   **types/** define shared TypeScript types

------------------------------------------------------------------------

# 3. Feature Module Pattern

Each domain feature should follow a modular structure.

Example: Lists

    src/features/lists/
    ├─ queries.ts
    ├─ mutations.ts
    ├─ helpers.ts
    └─ types.ts

Responsibilities:

  File           Purpose
  -------------- ------------------
  queries.ts     Convex queries
  mutations.ts   Convex mutations
  helpers.ts     domain utilities
  types.ts       domain types

------------------------------------------------------------------------

# 4. Hooks Pattern

Hooks expose feature logic to the UI layer.

Example:

    src/hooks/useLists.ts

Example implementation:

``` ts
export function useLists() {
  const lists = useQuery(api.lists.getAll)
  const createList = useMutation(api.lists.create)

  return {
    lists,
    createList
  }
}
```

Guidelines:

-   hooks should be thin wrappers
-   no UI logic inside hooks
-   no direct Convex usage in components

------------------------------------------------------------------------

# 5. Component Design Rules

Components should follow a **presentation-first** model.

Types of components:

  Type                 Description
  -------------------- -----------------------------
  UI components        generic reusable components
  Feature components   domain-specific UI
  Screens              route-level components

Example:

    components/ui/Button.tsx
    components/lists/ListCard.tsx
    app/list/[id].tsx

------------------------------------------------------------------------

# 6. State Management

Shopp uses **Zustand** only for UI state.

Recommended stores:

    uiStore
    draftStore
    filtersStore
    appStore

State examples:

  Store          Example
  -------------- -----------------
  uiStore        modals, toasts
  draftStore     editing forms
  filtersStore   search filters
  appStore       global settings

Backend data should **not be duplicated in Zustand**.

------------------------------------------------------------------------

# 7. Convex Backend Rules

Convex handles:

-   persistence
-   realtime updates
-   backend logic

Structure:

    convex/
    ├─ schema.ts
    ├─ lists.ts
    ├─ listItems.ts
    ├─ stores.ts
    ├─ products.ts
    ├─ pricing.ts
    ├─ purchases.ts

Best practices:

-   keep queries small
-   validate input
-   avoid complex logic in UI

------------------------------------------------------------------------

# 8. Naming Conventions

## Files

    camelCase for hooks
    PascalCase for components
    kebab-case for folders

Examples:

    useLists.ts
    ListCard.tsx
    store-selector/

## Variables

    camelCase

Example:

    listItems
    selectedStore
    currentListId

------------------------------------------------------------------------

# 9. Offline Strategy

Shopp supports partial offline usage.

Data sources:

1.  Convex backend
2.  Local cache
3.  JSON seeds

Flow:

    UI
    ↓
    Hook
    ↓
    Convex query
    ↓
    fallback to cache
    ↓
    fallback to seed data

------------------------------------------------------------------------

# 10. Git Workflow

Recommended branch structure:

    main
    develop
    feature/*
    fix/*

Example:

    feature/store-selector
    feature/barcode-scan
    fix/list-render

Commit style:

    feat: add store selector
    fix: correct list item mutation
    refactor: move pricing logic
    docs: update architecture

------------------------------------------------------------------------

# 11. Testing Strategy

Testing layers:

  Layer      Test
  ---------- -------------------
  lib        unit tests
  features   integration tests
  UI         snapshot tests

Recommended tools:

-   Jest
-   React Testing Library

------------------------------------------------------------------------

# 12. Code Review Checklist

Before merging:

-   architecture respected
-   no business logic in UI
-   types defined
-   hooks used correctly
-   no duplicated logic

------------------------------------------------------------------------

# 13. Performance Guidelines

Important rules:

-   avoid unnecessary re-renders
-   memoize heavy components
-   keep Convex queries small
-   paginate large datasets

------------------------------------------------------------------------

# 14. Roadmap Development Order

Recommended implementation order:

1.  Lists
2.  ListItems
3.  Stores
4.  Purchases
5.  Products
6.  Pricing
7.  Product learning
8.  Advanced analytics

------------------------------------------------------------------------

# 15. Documentation

Documentation should live in:

    docs/

Recommended files:

    architecture.md
    data-model.md
    development-guide.md
    api-reference.md

------------------------------------------------------------------------

# Conclusion

Following these conventions ensures:

-   maintainable code
-   predictable structure
-   scalable architecture
-   easier collaboration
