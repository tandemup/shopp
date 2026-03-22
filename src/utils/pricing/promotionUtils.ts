import { Promotion } from "./Promotion";

/* =========================================================
   NORMALIZACIÓN
   Convierte cualquier promo a su forma canónica
========================================================= */

export function normalizePromotion(promo?: Promotion): Promotion {
  if (!promo) return { type: "none" };

  switch (promo.type) {
    case "2x1":
      return { type: "multi", buy: 2, pay: 1 };

    case "3x2":
      return { type: "multi", buy: 3, pay: 2 };

    default:
      return promo;
  }
}

/* =========================================================
   STRING → Promotion (UI → lógica)
========================================================= */

export const toPromotion = (id: string): Promotion => {
  if (id === "none") return { type: "none" };

  if (id === "2x1") return { type: "2x1" };
  if (id === "3x2") return { type: "3x2" };

  // 💥 DESCUENTO FIJO
  if (id.startsWith("discount")) {
    const value = Number(id.replace("discount", ""));
    return { type: "discount", value };
  }

  // 💥 PORCENTAJE (AQUÍ ESTÁ EL BUG)
  if (id.startsWith("percent")) {
    const value = Number(id.replace("percent", ""));
    return { type: "percent", value };
  }

  return { type: "none" };
};
/* =========================================================
   Promotion → string (persistencia / selects)
========================================================= */

export function fromPromotion(promo?: Promotion): string {
  if (!promo) return "none";

  switch (promo.type) {
    case "2x1":
      return "2x1";

    case "3x2":
      return "3x2";

    case "discount":
      return `discount${promo.value}`;

    case "percent":
      return `percent${promo.value}`;

    case "multi":
      // opcional: mapear a conocidos
      if (promo.buy === 2 && promo.pay === 1) return "2x1";
      if (promo.buy === 3 && promo.pay === 2) return "3x2";
      return `multi_${promo.buy}x${promo.pay}`;

    case "none":
    default:
      return "none";
  }
}

/* =========================================================
   LABEL PARA UI (badge)
========================================================= */

export function getPromotionLabel(promo?: Promotion): string {
  if (!promo || promo.type === "none") return "";

  switch (promo.type) {
    case "2x1":
      return "2x1";

    case "3x2":
      return "3x2";

    case "percent":
      return `-${promo.value}%`;

    case "discount":
      return `-${promo.value}€`;

    case "multi":
      return `${promo.buy}x${promo.pay}`;

    default:
      return "";
  }
}

/* =========================================================
   COLOR / ESTILO (opcional UI)
========================================================= */

export function getPromotionColor(promo?: Promotion): string {
  if (!promo || promo.type === "none") return "#999";

  switch (promo.type) {
    case "2x1":
    case "3x2":
    case "multi":
      return "#2ecc71"; // verde promo fuerte

    case "percent":
      return "#f39c12"; // naranja

    case "discount":
      return "#e74c3c"; // rojo ahorro directo

    default:
      return "#999";
  }
}

/* =========================================================
   VALIDACIÓN
========================================================= */

export function isPromotionValid(promo?: Promotion): boolean {
  if (!promo) return false;

  switch (promo.type) {
    case "percent":
      return promo.value > 0 && promo.value <= 100;

    case "discount":
      return promo.value > 0;

    case "multi":
      return promo.buy > 0 && promo.pay > 0 && promo.pay <= promo.buy;

    case "2x1":
    case "3x2":
    case "none":
      return true;

    default:
      return false;
  }
}

/* =========================================================
   HELPERS
========================================================= */

export function hasPromotion(promo?: Promotion): boolean {
  return !!promo && promo.type !== "none";
}
