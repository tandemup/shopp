import { useState } from "react";

export function useSearch() {
  const [query, setQuery] = useState("");

  return {
    query,
    setQuery,
  };
}
