
import React from "react"
import { View, Text } from "react-native"
import { commonStyles } from "../styles/commonStyles"

export default function ItemRow({ item }) {
  return (
    <View style={[commonStyles.row, { paddingVertical: 6 }]}>
      <Text>{item.name}</Text>
      <Text>{item.quantity}</Text>
    </View>
  )
}
