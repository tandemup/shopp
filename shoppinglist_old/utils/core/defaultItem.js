export const defaultPriceInfo = () => ({
  currency: "€",
  promo: "",
  promoLabel: "",
  qty: 1,
  savings: 0,
  subtotal: 0,
  summary: 0,
  total: 0,
  unit: "u",
  unitPrice: 0,
});

export const defaultItem = {
  id: "",
  name: "",
  brand: "",
  barcode: "",
  image: null,
  checked: true,
  priceInfo: defaultPriceInfo(),
};
const normalizePromoText = (value) => {
  if (typeof value !== "string") return "";
  const v = value.trim().toLowerCase();
  if (!v || v === "none") return "";
  return value;
};

export const normalizePriceInfo = (priceInfo) => {
  const base = defaultPriceInfo();

  // 🔒 Protección absoluta
  if (!priceInfo || typeof priceInfo !== "object") {
    return base;
  }

  return {
    ...base,
    ...priceInfo,

    // Normalización defensiva
    qty: Number(priceInfo.qty ?? base.qty),
    unit: priceInfo.unit ?? base.unit,
    unitPrice: Number(priceInfo.unitPrice ?? base.unitPrice),
    subtotal: Number(priceInfo.subtotal ?? base.subtotal),
    total: Number(priceInfo.total ?? base.total),
    savings: Number(priceInfo.savings ?? 0),
    promo: normalizePromoText(priceInfo.promo),
    promoLabel: normalizePromoText(priceInfo.promoLabel),

    summary: priceInfo.summary ?? base.summary,
    warning: priceInfo.warning ?? null,
  };
};
