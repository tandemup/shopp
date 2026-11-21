# Fase Node: migración de cuentas y datos desde Convex

## Estado

Express ya tiene autenticación JWT, listas, catálogo, historial de escaneos, tiendas, ofertas, chat básico y gestión de usuarios. El servidor incluye un importador inicial, en modo simulación por defecto, para cuentas verificadas, perfiles básicos, listas y artículos. Aún no hay un exportador que convierta directamente las tablas de Convex ni se ha ejecutado una importación con datos reales. Activar `EXPO_PUBLIC_BACKEND_PROVIDER=node` abre una base de datos separada; no traslada cuentas ni datos.

Este documento recoge el inventario, el formato que acepta el importador y los controles pendientes para preparar y validar una importación real. No contiene ni necesita credenciales ni una copia de producción.

## Correspondencias de datos

| Origen | Destino previsto | Estado / acción necesaria |
|---|---|---|
| Convex `users` y tablas de Convex Auth | `app_users` | El importador enlaza por ID Convex guardado en `convex_user_id`; solo acepta correos verificados y detiene coincidencias ambiguas. No copia sesiones activas ni contraseñas. Falta generar el snapshot desde los datos reales. |
| Convex `userProfiles` | `user_profiles` | La migración `012_user_profiles.sql` crea el destino y conserva alias, teléfono y preferencias básicas. Las referencias a avatares Convex quedan fuera. |
| Convex `_storage` (avatares, adjuntos, instantáneas) | Sin almacenamiento migrado | Descargar, copiar a un almacenamiento de objetos y reescribir referencias; no conservar IDs de almacenamiento Convex como si fueran URLs. |
| Convex `testerInvitations` | Sin tabla/endpoints completos en Node | Migrar solo invitaciones vigentes si se decide conservarlas; preservar expiración, aceptación y revocación. |
| Listas de `ListsContext` / `listsRepository` en AsyncStorage | `shopping_lists`, `shopping_list_items` | El importador acepta listas incluidas en el snapshot y conserva artículos y metadatos. Las listas que solo estén en AsyncStorage necesitan exportarse desde cada dispositivo. La tabla Convex `shoppingItemsImport` es una zona de staging y no importa automáticamente a PostgreSQL. |
| Convex `productCache` | `product_catalog` | Mapeo directo por código de barras; normalizar estados y preservar contadores y marcas de tiempo. |
| Convex `productReviewSubmissions` | `product_review_submissions` | Mapeo previsto. El panel Node ya revisa propuestas creadas en Node; falta importar las propuestas históricas si se quieren conservar. |
| Convex `userScanHistory` | `user_scan_history` | Asociar cada registro al usuario Node enlazado y validar códigos y fechas. |
| Convex `scanHistory`, `barcodeScans` | Sin destino equivalente completo | Decidir si son catálogo compartido, analítica o historial con consentimiento; definir retención y anonimización antes de copiar. |
| Convex `stores`, `userStoreFavorites`, `storeRequests` | `stores`, `user_store_favorites`, `store_requests` | Hay tablas y rutas Node. Importar primero tiendas, luego favoritos y solicitudes, y remapear IDs referenciados. |
| Convex `storeOfferSubmissions` | `store_offer_submissions` | Hay tabla y rutas. Importar después de tiendas y usuarios; comprobar valores de estado y autoría. |
| Convex `chatMessages` | `chat_messages` | Hay almacenamiento Node para mensajes de texto. Definir política para caducados, salas eliminadas, IDs de origen y mensajes con adjuntos antes de importar. |
| Convex `chatRoomControls`, `chatPlaylistShares` | Sin tabla equivalente | Migración pendiente; revisar metadatos de sala y enlaces compartidos junto a la fase de chat avanzado. |
| Playlists, tarjetas públicas, tutoriales, enlaces/biblioteca, parking, live, alarmas, presencia cercana, tutor de inglés, informes de derechos y ajustes de invitado | Sin esquema equivalente suficiente | Migrar como fases funcionales independientes; no intentar volcarlos a tablas genéricas de listas o mensajes. |

Los destinos PostgreSQL existentes se definen en `shopp-node-postgres/server/migrations/`. La lista de tablas Convex está en `convex/schema.js`.

## Importador inicial: cuentas verificadas y listas

El servidor incluye un importador para snapshots normalizados `shopp-convex-node`, versión 1. Procesa cuentas verificadas, perfiles básicos, listas y artículos. No importa contraseñas, archivos, tiendas, productos, historial, ofertas ni chat; esos elementos requieren sus propios mapeos. Por defecto, ejecuta las inserciones dentro de una transacción y termina en `ROLLBACK`.

Ejemplo mínimo del formato:

```json
{
  "format": "shopp-convex-node",
  "version": 1,
  "users": [{
    "convexUserId": "j...",
    "email": "persona@example.org",
    "name": "Persona",
    "emailVerifiedAt": 1790000000000,
    "createdAt": 1780000000000,
    "role": "user",
    "status": "active",
    "permissions": {},
    "profile": {
      "alias": "Persona",
      "phone": null,
      "phoneVisible": false,
      "scanHistorySyncEnabled": false
    }
  }],
  "lists": [{
    "convexUserId": "j...",
    "id": "lista-01",
    "name": "Compra",
    "currency": "EUR",
    "archived": false,
    "createdAt": 1780000000000,
    "items": [{ "id": "articulo-01", "name": "Leche", "checked": false }]
  }]
}
```

Desde `shopp-node-postgres`, ejecuta primero la simulación y revisa sus recuentos:

```bash
docker compose exec -T api npm run migration:convex < snapshot-node.json
```

La escritura exige la opción explícita `--apply`:

```bash
docker compose exec -T api npm run migration:convex -- --apply < snapshot-node.json
```

Añade `--preserve-roles` solo después de revisar y aprobar ese mapeo. Sin esa opción, las cuentas nuevas reciben rol `user` y permisos vacíos; las cuentas Node ya existentes conservan su rol/permisos. Las cuentas Convex bloqueadas se importan bloqueadas y las sesiones activas se revocan. El importador no enlaza cuentas por correo: si el correo ya pertenece a Node bajo otro ID, detiene la operación. Si una lista o artículo ya existe con datos distintos, también aborta para evitar sobrescribir cambios.

Las cuentas deben tener correo verificado y no se migran sus sesiones ni contraseñas. Después de importar, el usuario deberá establecer su contraseña en Node mediante el flujo de recuperación. Haz una copia de PostgreSQL antes de usar `--apply`.

## Decisiones que bloquean el importador

1. **Exportación real:** construir y revisar un exportador Convex que produzca el JSON documentado; incluir solo campos permitidos y comprobar cantidades, propietarios y referencias antes de pasarlo al importador.
2. **Identidad de cuenta:** usar el ID Convex como `convex_user_id` y asignar un ID Node nuevo. El importador detiene los correos que ya estén vinculados a otro ID Node; resolver esos casos manualmente, sin enlazarlos solo por correo.
3. **Acceso a cuentas:** no se migran contraseñas ni sesiones. Definir y comunicar cómo los usuarios establecerán su contraseña en Node; comprobar que el flujo de recuperación/verificación está disponible antes de cambiar de backend.
4. **Roles y permisos:** el modo predeterminado crea cuentas con rol `user` y permisos vacíos. Revisar los roles de origen y usar `--preserve-roles` solo con una tabla de correspondencias aprobada.
5. **Datos locales:** exportar por usuario las listas AsyncStorage que no estén en Convex; dejar los datos sin propietario fuera hasta resolver su atribución.
6. **Archivos y retención:** decidir qué avatares, imágenes, capturas, adjuntos, chats antiguos, ubicaciones y registros de presencia se conservan y en qué almacenamiento. No importar señales o presencia caducada.

## Orden de ejecución propuesto

1. Construir el exportador Convex y generar el snapshot normalizado, más una copia de respaldo restringida.
2. Revisar recuentos, campos ausentes, correos duplicados, propietarios y referencias antes de ejecutar el importador.
3. Cargar el snapshot en PostgreSQL de desarrollo y ejecutar el comando sin `--apply`; revisar recuentos y advertencias.
4. Probar idempotencia: volver a ejecutar la simulación y verificar el tratamiento de registros coincidentes y conflictos.
5. Completar el exportador/importador para tiendas, favoritos, solicitudes, ofertas, productos, historial y los módulos que se decida conservar.
6. Aprobar el informe, respaldar PostgreSQL e importar el conjunto acordado. Mantener Convex como fuente activa durante la validación.
7. Hacer una sincronización final, cambiar el proveedor y conservar un procedimiento de reversión antes de retirar Convex.

## Criterios para cerrar la fase

- Todas las cuentas que se conservarán tienen un mapeo único y método de acceso Node definido.
- Los roles y permisos han sido revisados y ningún usuario recibe privilegios mayores por defecto.
- Las listas se pueden reconstruir con sus artículos, precios, estados de compra, archivo y tienda asignada.
- Los datos que no se importan tienen una decisión documentada de descarte, conservación en Convex o migración posterior.
- Dos ejecuciones de ensayo no duplican filas; los errores producen un informe recuperable y no dejan una importación parcial indetectable.
- Existe una comprobación de recuentos y un procedimiento de reversión antes del cambio de producción.

## Fuera de alcance de esta fase

Esta fase no migra todavía las funciones de música, biblioteca, parking, directo, alarmas, chat avanzado ni almacenamiento de archivos. Se mantienen en Convex hasta que cada fase tenga API, permisos, pantallas y plan de datos propios.
