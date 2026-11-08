# Shopp — Fase 2A: servidor independiente

## Estado del ZIP de origen

La copia `shopp-main (16).zip` contiene los tests de 1A y 1B, pero **no** contiene los archivos de las fases 1C, 1D o 1E. Este paquete NO instala esos cambios y no modifica `App.js`, Expo o Convex.

## Contenido

- `server/src/app.js`: rutas `GET /api/health` y `GET /api/ready`.
- `server/src/db.js`: pool PostgreSQL.
- `server/compose.yaml`: API Express y base PostgreSQL, vinculadas a localhost en el Mac.
- `server/sql/001_initial.sql`: registro básico de futuras migraciones (ejecutado al crear el volumen por primera vez).
- `server/tests/`: pruebas de configuración y rutas.

## Ejecutar con Docker Desktop (recomendado)

1. Desde `~/Developer/shopp/server`, crear `server/.env` con `POSTGRES_PASSWORD` fuerte (no subirlo a Git). Por ejemplo: `printf 'POSTGRES_PASSWORD=...\\n' > .env` reemplazando los puntos. **No usar una contraseña de ejemplo en producción**.
2. Ejecutar `docker compose up --build -d`.
3. Probar `curl http://127.0.0.1:3000/api/health` y `curl http://127.0.0.1:3000/api/ready`.
4. Examinar registros: `docker compose logs -f api`.
5. Parar sin borrar datos: `docker compose down` (NO usar `-v` salvo que se quiera destruir el volumen).

## DBeaver

Crear conexión PostgreSQL, host `127.0.0.1`, puerto `5432`, BD `shopp`, usuario `shopp_app`, contraseña `POSTGRES_PASSWORD` de `.env`.

## Ejecutar servidor fuera de Docker

Si PostgreSQL ya está iniciado localmente, `cd server && npm install && cp .env.example .env`; configurar `DATABASE_URL` real y `npm run dev`.

## Pruebas

`cd server && npm install && npm test`

## Seguridad y límites

- Los puertos `3000` y `5432` están publicados solo sobre `127.0.0.1` para desarrollo local, no deben exponerse a Internet.
- No existe todavía autenticación, Socket.IO, endpoints de negocio ni migración de datos Convex.
- No poner `EXPO_PUBLIC_BACKEND_PROVIDER=node`. El frontend sigue usando Convex.
- `server/.env` es local y está ignorado por `server/.gitignore`.
- PostgreSQL crea `schema_migrations` al inicializar el volumen por primera vez; cambiar ese SQL después no modifica volúmenes existentes.
