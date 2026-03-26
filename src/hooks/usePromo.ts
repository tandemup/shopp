import { Promotion } from "@/src/types/Promotion";
import {
  fromPromotion,
  toPromotion,
} from "@/src/utils/pricing/PromotionMapper";
import { useEffect, useMemo, useState } from "react";

export function usePromo(initial?: Promotion) {
  const [promoString, setPromoString] = useState<string>(
    fromPromotion(initial),
  );

  useEffect(() => {
    setPromoString(fromPromotion(initial));
  }, [initial]);

  const promo: Promotion = useMemo(() => {
    return toPromotion(promoString);
  }, [promoString]);

  const setPromoFromString = (id: string) => {
    setPromoString(id);
  };

  return {
    promo,
    promoString,
    setPromoFromString,
  };
}
