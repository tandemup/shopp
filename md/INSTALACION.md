# Utilidad de supermercados para Shopp

1. Copia las carpetas `src`, `convex` y `data` sobre la raíz del proyecto.
2. Ejecuta `npx convex dev` para desplegar el esquema y regenerar la API.
3. Entra con un administrador en `Settings > Catálogo de supermercados`.
4. Importa `data/stores.json` usando **Combinar**. El archivo contiene las 19 tiendas que estaban en `src/constants/stores.js`.

## Flujos incluidos

- Los compradores pueden proponer supermercados con ubicación GPS.
- El administrador revisa la propuesta; al aprobarla se crea en `stores` o se enlaza con un duplicado existente.
- Los compradores pueden comunicar ofertas observadas.
- Los propietarios pueden enviar solicitudes comerciales con datos de contacto.
- El administrador aprueba o rechaza ofertas y solicitudes.
- Solo las ofertas aprobadas aparecen en `Tiendas > Ofertas de supermercados`.
- El catálogo puede exportarse e importarse con el formato `shopp-supermarkets`, versión 1.

La importación **Combinar** conserva el catálogo y actualiza por `id`. **Reemplazar todo** elimina primero las tiendas actuales; úsala solo con una copia exportada y revisada.
