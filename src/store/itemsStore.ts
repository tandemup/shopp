import itemsData from "../../data/items.json";

let items = [...itemsData];

export function getItems() {
  return items;
}

export function getItem(id: string) {
  return items.find((i) => i.id === id);
}

export function updateItem(updatedItem: any) {
  items = items.map((i) => (i.id === updatedItem.id ? updatedItem : i));
}

export function removeItem(id: string) {
  items = items.filter((i) => i.id !== id);
}
