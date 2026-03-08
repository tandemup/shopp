# PROJECT_STRUCTURE_REFERENCE.md

Reference structure for the **Shopp** repository.

This document describes the recommended **complete folder and file
structure** for the project so that architecture remains consistent as
the application grows.

------------------------------------------------------------------------

# Root Structure

    shopp/
    ├─ app/
    ├─ src/
    ├─ convex/
    ├─ data/
    ├─ assets/
    ├─ docs/
    ├─ package.json
    ├─ tsconfig.json
    └─ README.md

------------------------------------------------------------------------

# app/ (Expo Router)

Contains only **screens and navigation**.

    app/
    ├─ _layout.tsx
    │
    ├─ (tabs)/
    │  ├─ _layout.tsx
    │  ├─ index.tsx
    │  ├─ stores.tsx
    │  ├─ barcode.tsx
    │  └─ settings.tsx
    │
    ├─ list/
    │  └─ [id].tsx
    │
    └─ (modals)/
       ├─ create-list.tsx
       ├─ add-item.tsx
       ├─ edit-item.tsx
       └─ select-store.tsx

Rules:

-   No business logic
-   Only UI orchestration
-   Uses hooks for data

------------------------------------------------------------------------

# src/

Contains **all application logic**.

    src/
    ├─ components/
    ├─ features/
    ├─ hooks/
    ├─ services/
    ├─ store/
    ├─ lib/
    ├─ types/
    └─ constants/

------------------------------------------------------------------------

# src/components

Reusable UI components.

    components/
    ├─ ui/
    │  ├─ Button.tsx
    │  ├─ Card.tsx
    │  ├─ Checkbox.tsx
    │  ├─ Badge.tsx
    │  ├─ Input.tsx
    │  ├─ Modal.tsx
    │  └─ Dialog.tsx
    │
    ├─ lists/
    │  ├─ ListCard.tsx
    │  ├─ ListHeader.tsx
    │  ├─ ListSummary.tsx
    │  └─ CreateListForm.tsx
    │
    ├─ items/
    │  ├─ ItemRow.tsx
    │  ├─ ItemPriceBadge.tsx
    │  ├─ ItemQuantityControl.tsx
    │  ├─ AddItemForm.tsx
    │  └─ EditItemForm.tsx
    │
    ├─ stores/
    │  ├─ StoreCard.tsx
    │  ├─ StoreSelector.tsx
    │  └─ StoreDistanceBadge.tsx
    │
    └─ purchases/
       ├─ PurchaseCard.tsx
       └─ PurchaseItemRow.tsx

------------------------------------------------------------------------

# src/features

Domain logic separated by feature.

    features/
    ├─ lists/
    │  ├─ queries.ts
    │  ├─ mutations.ts
    │  ├─ helpers.ts
    │  └─ types.ts
    │
    ├─ listItems/
    │  ├─ queries.ts
    │  ├─ mutations.ts
    │  └─ helpers.ts
    │
    ├─ stores/
    │  ├─ queries.ts
    │  ├─ mutations.ts
    │  └─ helpers.ts
    │
    ├─ products/
    │  ├─ queries.ts
    │  ├─ mutations.ts
    │  └─ helpers.ts
    │
    ├─ pricing/
    │  ├─ priceEngine.ts
    │  └─ helpers.ts
    │
    └─ purchases/
       ├─ queries.ts
       ├─ mutations.ts
       └─ helpers.ts

------------------------------------------------------------------------

# src/hooks

Hooks used by screens and components.

    hooks/
    ├─ useLists.ts
    ├─ useListItems.ts
    ├─ useStores.ts
    ├─ useProducts.ts
    ├─ usePurchases.ts
    └─ useTheme.ts

Hooks should:

-   call Convex queries/mutations
-   expose simple interfaces to UI

------------------------------------------------------------------------

# src/services

Infrastructure services.

    services/
    ├─ convex/
    │  ├─ client.ts
    │  └─ mappers.ts
    │
    ├─ storage/
    │  ├─ cache.ts
    │  ├─ localStorage.ts
    │  └─ seedLoader.ts
    │
    └─ search/
       └─ productSearch.ts

------------------------------------------------------------------------

# src/store

Zustand stores.

    store/
    ├─ uiStore.ts
    ├─ appStore.ts
    ├─ draftStore.ts
    └─ filtersStore.ts

------------------------------------------------------------------------

# src/lib

Utility libraries.

    lib/
    ├─ ids.ts
    ├─ dates.ts
    ├─ currency.ts
    ├─ units.ts
    ├─ geo.ts
    ├─ barcode.ts
    └─ validation.ts

------------------------------------------------------------------------

# src/types

Shared TypeScript types.

    types/
    ├─ list.ts
    ├─ item.ts
    ├─ store.ts
    ├─ product.ts
    ├─ purchase.ts
    └─ pricing.ts

------------------------------------------------------------------------

# src/constants

Static constants.

    constants/
    ├─ colors.ts
    ├─ spacing.ts
    ├─ currencies.ts
    ├─ units.ts
    └─ app.ts

------------------------------------------------------------------------

# convex/

Convex backend.

    convex/
    ├─ schema.ts
    ├─ lists.ts
    ├─ listItems.ts
    ├─ stores.ts
    ├─ products.ts
    ├─ pricing.ts
    ├─ purchases.ts
    ├─ productLearning.ts
    └─ seeds.ts

------------------------------------------------------------------------

# data/

Local JSON seeds.

    data/
    ├─ stores.json
    ├─ items.json
    ├─ categories.json
    ├─ units.json
    └─ demoLists.json

------------------------------------------------------------------------

# assets/

Static assets.

    assets/
    ├─ icons/
    ├─ images/
    ├─ splash/
    └─ fonts/

------------------------------------------------------------------------

# docs/

Project documentation.

    docs/
    ├─ shopp_architecture.md
    ├─ shopp_data_model.md
    ├─ shopp_convex_schema.md
    ├─ SHopp_DEVELOPMENT_GUIDE.md
    ├─ CONVEX_SCHEMA_FULL.md
    ├─ DATABASE_DIAGRAM.md
    ├─ PROJECT_ROADMAP.md
    ├─ ARCHITECTURE_DIAGRAMS.md
    └─ PROJECT_STRUCTURE_REFERENCE.md

------------------------------------------------------------------------

# Summary

This structure ensures:

-   separation of concerns
-   scalable architecture
-   maintainable modules
-   predictable repository organization
