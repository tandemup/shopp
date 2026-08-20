export function validatePromotionUnit(promo, unit) {
  if (!promo || promo.type === "none") {
    return { valid: true };
  }

  if (["multi", "secondUnit"].includes(promo.type) && unit !== "u") {
    return {
      valid: false,
      message:
        "Ofertas tipo 2x1 / 3x2 / 2.ª unidad solo válidas para unidades (u)",
    };
  }

  return { valid: true };
}
