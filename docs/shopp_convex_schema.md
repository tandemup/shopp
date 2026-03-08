# Convex Backend Structure

Recommended folder:

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

Responsibilities:

  File           Purpose
  -------------- ------------------------
  schema.ts      database schema
  lists.ts       list queries/mutations
  listItems.ts   item operations
  stores.ts      store data
  products.ts    product catalog
  pricing.ts     price tracking
  purchases.ts   purchase history
  seeds.ts       bootstrap data

Convex provides:

-   realtime queries
-   backend functions
-   sync between clients
