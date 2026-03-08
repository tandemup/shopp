// pricingEngine.js
// 🧠 Motor único de precios, promociones y formateo

/* ======================================================
 * 📦 PROMOCIONES
 * ====================================================== */
export const NO_PROMO = "none";

export const PROMOTIONS = {
  [NO_PROMO]: {
    label: "Sin oferta",
    isApplicable: () => true,
    apply: (price, qty) => price * qty,
  },

  "2x1": {
    label: "2x1",
    isApplicable: (qty) => qty >= 2,
    apply: (price, qty) => {
      const pairs = Math.floor(qty / 2);
      const rest = qty % 2;
      return (pairs + rest) * price;
    },
  },

  "3x2": {
    label: "3x2",
    isApplicable: (qty) => qty >= 3,
    apply: (price, qty) => {
      const sets = Math.floor(qty / 3);
      const rest = qty % 3;
      return (sets * 2 + rest) * price;
    },
  },

  discount10: {
    label: "10%",
    isApplicable: () => true,
    apply: (price, qty) => price * qty * 0.9,
  },

  discount20: {
    label: "20%",
    isApplicable: () => true,
    apply: (price, qty) => price * qty * 0.8,
  },
};

// 🧮 Calcula el total aplicando la promoción seleccionada
export function calcularPromoTotal(promoKey, price, qty) {
  const promo = PROMOTIONS[promoKey] || PROMOTIONS.none;

  if (isNaN(price) || isNaN(qty)) {
    return { total: 0, warning: "Valores inválidos", label: promo.label };
  }

  const isValid = promo.isApplicable(qty);
  const total = promo.apply(price, qty);

  let warning = null;
  if (!isValid && promoKey !== "none") {
    warning = `Esta oferta no aplica a la cantidad (${qty}) seleccionada.`;
  }

  return { total, warning, label: promo.label };
}

/* ======================================================
 * 🌐 I18N / TEXTO
 * ====================================================== */

const LANG = {
  es: {
    unitFallback: "u",
    plural: {
      u: "u",
      unit: "unidades",
      kg: "kg",
      g: "g",
      l: "l",
      ml: "ml",
    },
    multiply: "×",
    arrow: "→",
  },
};

/* ======================================================
 * 🔧 HELPERS
 * ====================================================== */

function formatMoney(value, currency, position = "after") {
  const n = Number(value || 0).toFixed(2);
  return position === "before" ? `${currency}${n}` : `${n} ${currency}`;
}

function pluralizeUnit(unit, qty, lang = "es") {
  const dict = LANG[lang].plural;
  const fallback = LANG[lang].unitFallback;

  if (!unit) return `${qty} ${fallback}`;
  if (qty === 1) return `${qty} ${unit}`;

  return `${qty} ${dict[unit] ?? unit}`;
}

function applyPromotion(unitPrice, qty, promoKey) {
  const promo = PROMOTIONS[promoKey] ?? PROMOTIONS.none;

  if (!promo.isApplicable(qty)) {
    return {
      total: PROMOTIONS.none.apply(unitPrice, qty),
      savings: 0,
      warning: `Esta oferta no aplica a ${qty} unidades`,
      promoLabel: promo.label,
    };
  }

  const subtotal = unitPrice * qty;
  const total = promo.apply(unitPrice, qty);

  return {
    total,
    savings: subtotal - total,
    warning: null,
    promoLabel: promo.label,
  };
}

/* ======================================================
 * 🧮 PRICING ENGINE (API PÚBLICA)
 * ====================================================== */

export class PricingEngine {
  /**
   * Calcula toda la info de precio normalizada
   */
  static calculate({
    qty = 1,
    unit = "u",
    unitPrice = 0,
    currency = "EUR",
    promo = "none",
    lang = "es",
  }) {
    const subtotal = qty * unitPrice;

    const promoResult = applyPromotion(unitPrice, qty, promo);

    const unitLabel = unit || LANG[lang].unitFallback;

    const baseLine =
      `${pluralizeUnit(unitLabel, qty, lang)} ` +
      `${LANG[lang].multiply} ` +
      `${formatMoney(unitPrice, currency)}/${unitLabel}`;

    const summary =
      `${baseLine}\n` +
      `${LANG[lang].arrow} ${formatMoney(promoResult.total, currency)}`;

    return {
      qty,
      unit: unitLabel,
      unitPrice,
      currency,

      promo,
      promoLabel: promoResult.promoLabel,

      subtotal,
      total: promoResult.total,
      savings: promoResult.savings,

      summary,
      warning: promoResult.warning,
    };
  }
}

export class PriceFormatter {
  //
  // 🌐 Idiomas soportados
  //
  static LANG = {
    es: {
      unitFallback: "u",
      plural: {
        u: "unidades",
        unit: "unidades",
        unidad: "unidades",
        kg: "kg",
        g: "g",
        l: "L",
        ml: "ml",
      },
      promoDescription: (promo, qty, paid) =>
        `${promo}: pagas ${paid} y te llevas ${qty}`,
      arrow: "→",
      multiply: "×",
    },

    en: {
      unitFallback: "u",
      plural: {
        u: "units",
        unit: "units",
        kg: "kg",
        g: "g",
        l: "L",
        ml: "ml",
      },
      promoDescription: (promo, qty, paid) =>
        `${promo}: pay ${paid} get ${qty}`,
      arrow: "→",
      multiply: "×",
    },
  };

  //
  // 🔢 Aplica la promo real
  //
  static applyPromotion(unitPrice, qty, promoKey) {
    const promo = PROMOTIONS[promoKey] ?? PROMOTIONS.none;

    if (!promo.isApplicable(qty)) {
      return PROMOTIONS.none.apply(unitPrice, qty);
    }
    return promo.apply(unitPrice, qty);
  }

  //
  // 💰 Formato monetario flexible
  //
  static formatMoney(value, currency, position = "after") {
    const n = value.toFixed(2);
    return position === "before" ? `${currency}${n}` : `${n} ${currency}`;
  }

  //
  // 🔤 Pluralización automática por unidad
  //
  static pluralizeUnit(unit, qty, lang = "es") {
    const dict = this.LANG[lang].plural;
    const fallback = this.LANG[lang].unitFallback;

    if (!unit) return `${qty} ${fallback}`;
    if (qty === 1) return `${qty} ${unit}`;

    return `${qty} ${dict[unit] ?? unit}`;
  }

  //
  // 🧠 Genera texto descriptivo de la promoción
  //
  static promoExplanation(promoKey, qty, lang = "es") {
    if (!promoKey || promoKey === "none") return "";

    const promo = PROMOTIONS[promoKey];
    if (!promo || !promo.explain) return `(${promoKey})`;

    // promo.explain debe devolver: { qty: 3, pay: 2 }
    const data = promo.explain(qty) ?? null;
    if (!data) return `(${promoKey})`;

    const { qty: offerQty, pay } = data;
    const explainFn = this.LANG[lang].promoDescription;

    return `${explainFn(promoKey, offerQty, pay)}`;
  }

  //
  // 🧾 Línea completa estilo ItemRow
  //
  static formatLine({
    qty,
    unitPrice,
    promo = "none",
    unit = "u",
    currency = "EUR",
    currencyPosition = "after",
    lang = "es",
    showPromoExplain = false,
  }) {
    const L = this.LANG[lang];

    // Total real
    const total = this.applyPromotion(unitPrice, qty, promo);

    // 3 u × 3.00 €/u
    const unitLabel = unit || L.unitFallback;

    const baseLeft =
      `${this.pluralizeUnit(unitLabel, qty, lang)} ` +
      `${L.multiply} ` +
      `${this.formatMoney(unitPrice, currency, currencyPosition)}/${unitLabel}`;

    const totalStr = this.formatMoney(total, currency, currencyPosition);

    let promoLabel = "";
    if (promo !== "none") {
      promoLabel = showPromoExplain
        ? ` (${this.promoExplanation(promo, qty, lang)})`
        : ` (${promo})`;
    }

    return `${baseLeft} ${L.arrow} ${totalStr}${promoLabel}`;
  }
  static formatLineDetailed({
    qty,
    unitPrice,
    promo = "none",
    unit = "u",
    currency = "EUR",
    lang = "es",
    currencyPosition = "after",
    showPromoExplain = false,
  }) {
    const promoObj = PROMOTIONS[promo] ?? PROMOTIONS.none;
    const promoLabel = promoObj.label ?? promo;

    // Total calculado con la promoción
    const total = this.applyPromotion(unitPrice, qty, promo);

    // Línea ya generada en la función base
    const line = this.formatLine({
      qty,
      unitPrice,
      promo: promoLabel, // <-- usa LABEL ahora
      unit,
      currency,
      lang,
      currencyPosition,
      showPromoExplain,
    });

    return {
      line,
      total,
      currency,
      promoKey: promo,
      promoLabel,
    };
  }

  //
  // Solo total, sin texto
  //
  static calculateTotal({ qty, unitPrice, promo = "none" }) {
    return this.applyPromotion(unitPrice, qty, promo);
  }
}
