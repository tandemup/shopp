
import React from "react"
import { View, Text, TouchableOpacity } from "react-native"
import { commonStyles } from "../styles/commonStyles"
import { useRouter } from "expo-router"

export default function ListCard({ list }) {
  const router = useRouter()

  return (
    <TouchableOpacity
      style={commonStyles.card}
      onPress={() => router.push(`/list/${list.id}`)}
    >
      <Text style={{ fontWeight: "600" }}>{list.name}</Text>

      <Text>
        Archived: {list.archived ? "Yes" : "No"}
      </Text>

      <Text>EUR</Text>
    </TouchableOpacity>
  )
}
