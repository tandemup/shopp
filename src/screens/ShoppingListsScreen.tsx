
import React, { useState } from "react"
import { SafeAreaView, Text, TextInput, Button, FlatList } from "react-native"
import { commonStyles } from "../styles/commonStyles"
import { useLists } from "@/src/context/ListsContext"
import ListCard from "../components/ListCard"

export default function ShoppingListsScreen() {

  const { lists, createList } = useLists()
  const [name, setName] = useState("")

  return (
    <SafeAreaView style={commonStyles.container}>

      <Text style={commonStyles.title}>Shopping Lists</Text>

      <TextInput
        placeholder="Nueva lista..."
        value={name}
        onChangeText={setName}
        style={commonStyles.input}
      />

      <Button
        title="Crear lista"
        onPress={() => {
          if (!name) return
          createList(name)
          setName("")
        }}
      />

      <FlatList
        data={lists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListCard list={item} />
        )}
      />

    </SafeAreaView>
  )
}
