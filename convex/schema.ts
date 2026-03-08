import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const priceInfoValidator = v.object({
  qty: v.number(),
  unit: v.string(),
  unitPrice: v.number(),
  currency: v.string(),
  promo: v.string(),
  promoLabel: v.string(),
  subtotal: v.number(),
  total: v.number(),
  savings: v.number(),
  summary: v.string(),
  warning: v.optional(v.union(v.string(), v.null())),
});

export default defineSchema({
  stores: defineTable({
    name: v.string(),
    city: v.optional(v.string()),
    provincia: v.optional(v.string()),
    address: v.string(),
    zipcode: v.optional(v.union(v.string(), v.number())),
    location: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        source: v.optional(v.string()),
      }),
    ),
    favorite: v.boolean(),
    isActive: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_favorite", ["favorite"]),

  lists: defineTable({
    name: v.string(),
    currency: v.string(),
    storeId: v.optional(v.id("stores")),
    archived: v.boolean(),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    totalItems: v.optional(v.number()),
    checkedItems: v.optional(v.number()),
  })
    .index("by_archived", ["archived"])
    .index("by_store", ["storeId"])
    .index("by_createdAt", ["createdAt"]),

  listItems: defineTable({
    listId: v.id("lists"),
    name: v.string(),
    normalizedName: v.optional(v.string()),
    quantity: v.number(),
    unit: v.optional(v.string()),
    unitPrice: v.number(),
    checked: v.boolean(),
    promo: v.optional(v.string()),
    barcode: v.optional(v.string()),
    category: v.optional(v.string()),
    note: v.optional(v.string()),
    priceInfo: v.optional(priceInfoValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_list", ["listId"])
    .index("by_barcode", ["barcode"])
    .index("by_name", ["name"])
    .index("by_checked", ["checked"]),

  purchases: defineTable({
    listId: v.optional(v.id("lists")),
    storeId: v.optional(v.id("stores")),
    date: v.string(),
    total: v.number(),
    currency: v.string(),
    createdAt: v.number(),
  })
    .index("by_store", ["storeId"])
    .index("by_date", ["date"]),

  purchaseItems: defineTable({
    purchaseId: v.id("purchases"),
    name: v.string(),
    normalizedName: v.optional(v.string()),
    quantity: v.number(),
    unit: v.optional(v.string()),
    unitPrice: v.number(),
    promo: v.optional(v.string()),
    barcode: v.optional(v.string()),
    category: v.optional(v.string()),
    priceInfo: v.optional(priceInfoValidator),
    purchasedAt: v.number(),
  })
    .index("by_purchase", ["purchaseId"])
    .index("by_barcode", ["barcode"])
    .index("by_name", ["name"]),

  productLearning: defineTable({
    normalizedName: v.string(),
    selects: v.number(),
    lastSelect: v.string(),
  }).index("by_normalizedName", ["normalizedName"]),
});
