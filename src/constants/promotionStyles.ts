export function getPromotionColor(promo?: Promotion): string {
  if (!promo || promo.type === "none") return "#999";

  switch (promo.type) {
    case "2x1":
    case "3x2":
    case "multi":
      return "#2ecc71";
    case "percent":
      return "#f39c12";
    case "discount":
      return "#e74c3c";
    default:
      return "#999";
  }
}
