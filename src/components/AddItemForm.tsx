
import React, { useState } from "react"
import { View, TextInput, Button } from "react-native"
import { commonStyles } from "../styles/commonStyles"
import { useItems } from "@/src/context/ItemsContext"

export default function AddItemForm({ listId }) {

  const { addItem } = useItems()

  const [name, setName] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [price, setPrice] = useState("")

  return (
    <View>

      <TextInput
        placeholder="Item name"
        value={name}
        onChangeText={setName}
        style={commonStyles.input}
      />

      <TextInput
        placeholder="quantity"
        value={quantity}
        onChangeText={setQuantity}
        style={commonStyles.input}
      />

      <TextInput
        placeholder="unit price"
        value={price}
        onChangeText={setPrice}
        style={commonStyles.input}
      />

      <Button
        title="Add item"
        onPress={() => {
          if (!name) return
          addItem(listId, name)
          setName("")
        }}
      />

    </View>
  )
}
