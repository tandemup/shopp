Aplicar Shopp Node independiente de Convex

Sobrescribe los ficheros del ZIP respetando sus rutas relativas. Después elimina estos archivos obsoletos del proyecto:

- Configurar_puente_Shopp.command
- convex/nodeSessionBridge.js
- src/context/NodeSessionContext.js
- docs/NODE_FASE_MIGRACION_DATOS.md
- shopp-node-postgres/server/src/routes/internalAuth.js
- shopp-node-postgres/server/src/migration/importConvexSnapshot.js
- shopp-node-postgres/server/migrations/012_user_profiles.sql

La columna opcional creada por `010_convex_identity_bridge.sql` puede permanecer en PostgreSQL: queda sin uso y no crea ni vincula cuentas. No borres volúmenes ni datos locales para aplicar este cambio.

No hace falta configurar `CONVEX_NODE_BRIDGE_SECRET` ni `SHOPP_NODE_API_URL`. Si esas variables siguen guardadas en Convex o en un `.env` privado, ya no las lee el proyecto; no pegues sus valores en chats.

Para usar Node, cada persona debe registrarse en las pantallas Node y verificar su correo. La autenticación Convex sigue funcionando de forma independiente cuando se selecciona ese proveedor.
