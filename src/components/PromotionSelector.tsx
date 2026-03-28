import type { Promotion } from "@/src/types/Promotion";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

// 👉 IMPORTA estas funciones (las que ya definimos)

import { isSamePromotion } from "@/src/utils/pricing/isSamePromotion";
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

export default function PromotionSelector({ value, onChange }: Props) {
  // ✅ normalización estable
  const promo = useMemo(() => normalizePromotion(value), [value]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ofertas</Text>

      <View style={styles.grid}>
        {PROMOTION_OPTIONS.map((option) => {
          const normalized = normalizePromotion(option);
          const selected = isSamePromotion(promo, normalized);

          return (
            <Pressable
              key={getKey(normalized)}
              onPress={() => onChange(normalized)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {getLabel(normalized)}
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
    case "none":
      return "none";
    case "2x1":
      return "2x1";
    case "3x2":
      return "3x2";
    case "percent":
      return `percent-${p.value}`;
    case "discount":
      return `discount-${p.value}`;
    case "multi":
      return `multi-${p.buy}x${p.pay}`;
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
