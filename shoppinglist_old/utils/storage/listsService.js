import { getItem, setItem } from "../utils/storage";

const KEY = "shopping_lists";

export const loadLists = () => getItem(KEY);
export const saveLists = (lists) => setItem(KEY, lists);
