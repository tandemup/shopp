# DATABASE_DIAGRAM.md

## Entity Relationships

    Store
     ├── Lists
     ├── Purchases
     └── Prices

    Product
     ├── Prices
     ├── ListItems
     └── PurchaseItems

    ShoppingList
     └── ListItems

    Purchase
     └── PurchaseItems

------------------------------------------------------------------------

## Relationship Table

  Parent     Child           Type
  ---------- --------------- ------
  Store      Lists           1:N
  Store      Purchases       1:N
  Store      Prices          1:N
  Product    Prices          1:N
  Product    ListItems       1:N
  Product    PurchaseItems   1:N
  List       ListItems       1:N
  Purchase   PurchaseItems   1:N
