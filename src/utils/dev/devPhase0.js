// utils/devPhase0.js
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * FASE 0 – Reset + sanity check
 * ⚠️ SOLO PARA DESARROLLO
 */
export async function runPhase0({ stores, favorites }) {
  console.group("🧪 FASE 0 – RESET + CHECK");

  try {
    // 1️⃣ Limpiar favoritas antiguas
    await AsyncStorage.removeItem("@favorite_stores");
    console.log("✔ Favoritas limpiadas (@favorite_stores)");

    // 2️⃣ Comprobar stores normalizados
    if (!stores?.length) {
      console.warn("❌ No hay tiendas cargadas");
    } else {
      const invalid = stores.filter(
        (s) => !s.id || s.id === "null" || s.id === "undefined"
      );

      console.log("Tiendas cargadas:", stores.length);
      console.log(
        "Primeros IDs:",
        stores.slice(0, 5).map((s) => s.id)
      );

      if (invalid.length > 0) {
        console.warn("❌ Tiendas con ID inválido:", invalid.slice(0, 3));
      } else {
        console.log("✔ Todas las tiendas tienen ID válido");
      }
    }

    // 3️⃣ Comprobar favoritas (deberían estar vacías)
    console.log("Favoritas actuales:", favorites ?? []);

    console.log("✅ FASE 0 completada correctamente");
  } catch (e) {
    console.error("❌ Error en FASE 0", e);
  }

  console.groupEnd();
}
