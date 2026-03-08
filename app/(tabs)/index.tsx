import { CreateListForm } from "@/components/lists/CreateListForm";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import React from "react";

import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function HomeScreen() {
  const router = useRouter();
  const lists = useQuery(api.lists.listActive);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Shopping Lists</Text>

        <CreateListForm />

        {!lists && <Text style={styles.info}>Loading lists...</Text>}

        {lists && lists.length === 0 && (
          <Text style={styles.info}>
            No active lists yet. Create your first one.
          </Text>
        )}

        {lists && (
          <FlatList
            data={lists}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                style={styles.card}
                onPress={() =>
                  router.push({
                    pathname: "/list/[id]",
                    params: { id: item._id },
                  })
                }
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.currency}>{item.currency}</Text>
                </View>

                <Text style={styles.cardMeta}>
                  {item.checkedItems ?? 0} / {item.totalItems ?? 0} checked
                </Text>

                <Text style={styles.cardMeta}>
                  Archived: {item.archived ? "Yes" : "No"}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  info: {
    fontSize: 15,
    color: "#666",
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  currency: {
    fontSize: 13,
    color: "#555",
  },
  cardMeta: {
    marginTop: 6,
    color: "#666",
  },
});
