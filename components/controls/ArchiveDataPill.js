import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Linking,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StoreSearchLink } from "./StoreSearchLink";

export const ArchivedDatePill = ({ archivedAt }) => (
  <View style={styles.metaPill}>
    <Ionicons name="calendar-outline" size={15} color="#6B7280" />
    <Text style={styles.subInfo} numberOfLines={1}>
      {new Date(archivedAt).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}
    </Text>
  </View>
);

export const StorePill = ({ store, onPressStore }) => (
  <View style={[styles.metaPill, styles.storePill]}>
    <StoreSearchLink store={store} onPressStore={onPressStore} />
  </View>
);

export const InfoRow = ({ archivedAt, store, onPressStore }) => (
  <View style={styles.infoRow}>
    <ArchivedDatePill archivedAt={archivedAt} />
    <StorePill store={store} onPressStore={onPressStore} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
    marginBottom: 20,
  },

  searchBar: {
    marginBottom: 16,
  },

  listContent: {
    paddingBottom: 60,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  cardText: {
    flex: 1,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  titlePressable: {
    flex: 1,
    paddingVertical: 2,
  },

  listTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },

  chevronPressable: {
    padding: 6,
    marginLeft: 8,
  },

  infoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },

  metaPill: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  storePill: {
    flexShrink: 1,
  },

  subInfo: {
    fontSize: 13,
    color: "#6B7280",
  },

  storeLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },

  storeText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },

  storeMutedText: {
    color: "#9CA3AF",
    fontSize: 13,
  },

  separator: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  productsText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },

  totalPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: "#16A34A",
  },

  itemsContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  itemIconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  itemContent: {
    flex: 1,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  itemName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    flexShrink: 1,
  },

  barcode: {
    fontSize: 12,
    color: "#2563EB",
    marginTop: 4,
  },

  summaryText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    lineHeight: 17,
  },

  savingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16A34A",
    marginTop: 4,
  },

  warningText: {
    fontSize: 12,
    color: "#B45309",
    marginTop: 4,
  },

  itemPriceColumn: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    minWidth: 82,
  },

  itemPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    marginLeft: 8,
  },

  offerBadgeInline: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 0,
  },

  offerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400E",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },

  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280",
    textAlign: "center",
  },
});
