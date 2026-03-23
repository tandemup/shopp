import { Promotion } from "@/src/types/Promotion";
import { toPromotion } from "@/src/utils/pricing/promotionMapper";
import { useEffect, useMemo, useState } from "react";

export function usePromo(initial?: string) {
  const [promoString, setPromoString] = useState(initial ?? "none");

  // 🔁 sincronización externa (clave)
  useEffect(() => {
    if (initial !== undefined) {
      setPromoString(initial);
    }
  }, [initial]);

  // 🧠 objeto derivado para pricing
  const promo: Promotion = useMemo(() => {
    return toPromotion(promoString);
  }, [promoString]);

  const setPromoFromString = (id: string) => {
    setPromoString(id);
  };

  return {
    promo, // objeto para PricingEngine
    promoString, // string para persistencia
    setPromoFromString,
  };
}
