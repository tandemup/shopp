# Migración Node: primera fase de listas

## Qué incluye

El modo `EXPO_PUBLIC_BACKEND_PROVIDER=node` deja de mostrar la pantalla temporal de sesión y abre una pantalla de listas conectada a Express y PostgreSQL. El modo `convex` conserva su navegación actual.

La pantalla Node permite:

- cargar las listas de la cuenta autenticada;
- crear listas con moneda EUR;
- abrir una lista y añadir o editar productos con cantidad, unidad, precio unitario, código de barras y categoría;
- buscar coincidencias en el catálogo Node por nombre, marca, categoría o código de barras;
- escanear códigos EAN/UPC con la cámara y consultar el catálogo Node;
- marcar y desmarcar productos;
- eliminar productos;
- calcular el subtotal estimado de los productos marcados;
- asignar una tienda del catálogo a cada lista y marcar tiendas favoritas;
- consultar ofertas aprobadas de la tienda asignada e incorporar su producto a la lista;
- comunicar una oferta nueva para revisión y consultar su estado (pendiente, aprobada o rechazada);
- archivar, restaurar y eliminar listas;
- cambiar el nombre de una lista;
- consultar un historial de compras agrupado por código de barras o nombre normalizado, usando solo los productos marcados en listas archivadas;
- ver el número de listas activas y archivadas.

Las peticiones usan el token JWT guardado por `NodeAuthContext` y las rutas `/api/v1/shopping`, `/api/v1/products`, `/api/v1/scans`, `/api/v1/stores` y `/api/v1/store-offers`. El servidor filtra los datos por el usuario autenticado. Al escanear un código, la pantalla actualiza el catálogo común y el historial de escaneos del usuario; al guardar un producto con un código válido, intenta registrar sus datos básicos para que aparezca en búsquedas futuras. La asignación de tienda actualiza `storeId` de la lista y sus favoritos se guardan por cuenta. Las ofertas aprobadas se leen del endpoint público y solo se muestran las que corresponden a la tienda asignada y están dentro de sus fechas de vigencia. Las nuevas ofertas se envían como solicitudes `shopper`. El endpoint autenticado `GET /api/v1/store-offers/mine` devuelve solo las solicitudes del usuario actual; la pestaña «Mis solicitudes» muestra el estado de revisión y permite actualizar el listado.

## Configuración local

En `.env.local`, configura la URL que Expo puede alcanzar y selecciona Node:

```dotenv
EXPO_PUBLIC_BACKEND_PROVIDER=node
EXPO_PUBLIC_API_URL=http://localhost:3001
```

Para probar desde otro dispositivo, `localhost` debe sustituirse por una URL HTTPS pública o por la dirección accesible de la máquina. Reinicia Expo después de cambiar variables de entorno.

Comprueba que Express y PostgreSQL están en ejecución y que `/api/ready` devuelve `status: ready`. Inicia sesión en Shopp con una cuenta registrada en el backend Node.

## Archivos principales

- `src/screens/auth/node/NodeShoppingListsScreen.js`: nueva interfaz y operaciones de listas.
- `src/screens/auth/node/NodeChatScreen.js`: chat Node básico con WebSocket.
- `src/navigation/NodeAppNavigator.js`: presenta la pantalla tras restaurar o iniciar sesión.
- `src/api/providers/node/shoppingLists.js` y `src/api/providers/node/products.js`: adaptadores REST que consume la pantalla.
- `src/api/providers/node/stores.js`: adaptador de catálogo y favoritos de tiendas.
- `src/api/providers/node/storeOffers.js`: adaptador para consultar ofertas, enviar solicitudes y leer las propias.
- `shopp-node-postgres/server/src/routes/shoppingLists.js`: endpoints Express ya existentes.
- `shopp-node-postgres/server/src/routes/products.js`: endpoint de búsqueda del catálogo.
- `shopp-node-postgres/server/src/routes/stores.js`: endpoints de tiendas y favoritos ya existentes.
- `shopp-node-postgres/server/src/routes/storeOffers.js`: ofertas aprobadas, envío de solicitudes y consulta segura de las propias.

## Alcance y siguiente trabajo

Esta migración vertical incorpora listas, historial, catálogo y escáner de productos, tiendas, ofertas y sus solicitudes. La pantalla nueva usa la API REST directamente y no cambia `ListsContext`, que sigue siendo la fuente de datos del flujo Convex. Las listas archivadas conservan todos sus productos para que puedan restaurarse; el historial computa únicamente los marcados. Los datos de precio se guardan en `priceInfo` y se envían también como campos de producto para mantener compatibilidad con las pantallas existentes. El chat Node básico está descrito en `docs/NODE_FASE_CHAT.md`; quedan por migrar sus funciones extendidas y el resto de módulos Convex.

No se incluyen archivos `.env` con secretos.
