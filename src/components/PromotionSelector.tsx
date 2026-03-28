import type { Promotion } from "@/src/types/Promotion";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

// 👉 IMPORTA estas funciones (las que ya definimos)

import { normalizePromotion } from "@/src/utils/pricing/pricing";

type Props = {
  value?: Promotion;
  onChange: (promo: Promotion) => void;
};

// 🔒 CONSTANTE FUERA DEL COMPONENTE (CRÍTICO)
const PROMOTION_OPTIONS: Promotion[] = [
  { type: "none" },
  { type: "2x1" },
  { type: "3x2" },
  { type: "multi", buy: 3, pay: 2 },
  { type: "percent", value: 10 },
  { type: "percent", value: 20 },
  { type: "discount", value: 5 },
];

const promotionComparators = {
  none: () => true,
  "2x1": () => true,
  "3x2": () => true,
  percent: (a, b) => a.value === b.value,
  discount: (a, b) => a.value === b.value,
  multi: (a, b) => a.buy === b.buy && a.pay === b.pay,
} satisfies Record<Promotion["type"], (a: any, b: any) => boolean>;

export const isSamePromotion = (a?: Promotion, b?: Promotion): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.type !== b.type) return false;

  return promotionComparators[a.type](a, b);
};

export default function PromotionSelector({ value, onChange }: Props) {
  // ✅ normalización estable
  const promo = useMemo(() => normalizePromotion(value), [value]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ofertas</Text>

      <View style={styles.grid}>
        {PROMOTION_OPTIONS.map((option) => {
          const selected = isSamePromotion(promo, option);

          return (
            <Pressable
              key={getKey(option)}
              onPress={() => onChange(normalizePromotion(option))}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {getLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// 🔑 key estable
const getKey = (p: Promotion) => {
  switch (p.type) {
    case "percent":
    case "discount":
      return `${p.type}-${p.value}`;
    case "multi":
      return `${p.type}-${p.buy}x${p.pay}`;
    default:
      return p.type;
  }
};

// 🏷 label UI
const getLabel = (p: Promotion) => {
  switch (p.type) {
    case "none":
      return "Sin oferta";
    case "2x1":
      return "2x1";
    case "3x2":
      return "3x2";
    case "multi":
      return `${p.buy}x${p.pay}`;
    case "percent":
      return `-${p.value}%`;
    case "discount":
      return `-${p.value}€`;
  }
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  title: {
    fontWeight: "600",
    marginBottom: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#eee",
  },
  chipSelected: {
    backgroundColor: "#000",
  },
  chipText: {
    fontSize: 13,
    color: "#000",
  },
  chipTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
});
