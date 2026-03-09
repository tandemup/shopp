import AsyncStorage from "@react-native-async-storage/async-storage"

export async function save(key: string, value: any) {
  await AsyncStorage.setItem(key, JSON.stringify(value))
}

export async function load(key: string) {
  const data = await AsyncStorage.getItem(key)
  return data ? JSON.parse(data) : null
}