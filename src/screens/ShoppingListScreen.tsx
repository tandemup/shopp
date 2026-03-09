
import React from "react"
import { SafeAreaView, Text, Button, FlatList } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { commonStyles } from "../styles/commonStyles"
import { useLists } from "@/src/context/ListsContext"
import { useItems } from "@/src/context/ItemsContext"
import AddItemForm from "../components/AddItemForm"
import ItemRow from "../components/ItemRow"

export default function ShoppingListScreen() {

  const { id } = useLocalSearchParams()
  const { lists } = useLists()
  const { items } = useItems()

  const list = lists.find(l => l.id === id)

  const listItems = items.filter(i => i.listId === id)

  return (
    <SafeAreaView style={commonStyles.container}>

      <Text style={commonStyles.title}>{list?.name}</Text>

      <Text>Store: none</Text>

      <Button title="Archive list" onPress={() => {}} />

      <AddItemForm listId={id} />

      <FlatList
        data={listItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ItemRow item={item} />
        )}
      />

    </SafeAreaView>
  )
}
