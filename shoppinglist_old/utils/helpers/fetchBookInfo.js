// 📚 Obtener datos de libros usando OpenLibrary (o similar)
export async function fetchBookInfo(code) {
  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${code}&jscmd=data&format=json`;
    const res = await fetch(url);
    const data = await res.json();

    const entry = data[`ISBN:${code}`];
    if (!entry) return null;

    return {
      name: entry.title ?? "Libro desconocido",
      brand: entry.publishers?.[0]?.name ?? "",
      image: entry.cover?.medium ?? null,
      url: entry.url ?? null,
    };
  } catch (e) {
    console.log("Error fetchBookInfo:", e);
    return null;
  }
}
