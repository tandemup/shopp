# Crear un servidor Node.js y PostgreSQL con Docker

Esta guía utiliza Docker Compose para iniciar una API Node.js/Express y una base de datos PostgreSQL. Los comandos se ejecutan desde Terminal, dentro de la carpeta del proyecto.

## 1. Requisitos

- Docker Desktop instalado y en ejecución (Mac o Windows), o Docker Engine con Docker Compose.
- La carpeta del proyecto, que debe contener `docker-compose.yml`, `server/` y `.env.example`.

Comprueba que Docker está disponible:

```bash
docker --version
docker compose version
```

## 2. Generar una contraseña segura

Genera una contraseña aleatoria de 24 bytes (48 caracteres hexadecimales):

```bash
openssl rand -hex 24
```

Copia el resultado. La contraseña hexadecimal no contiene caracteres que requieran escaparse en el archivo `.env`.

## 3. Crear el archivo `.env`

El archivo `.env.example` debe contener esta configuración de ejemplo:

```dotenv
POSTGRES_DB=shopp
POSTGRES_USER=shopp_app
POSTGRES_PASSWORD=change-this-to-a-long-random-password
API_PORT=3000
```

Crea una copia llamada `.env`:

```bash
cp .env.example .env
```

Abre `.env` con un editor. En macOS puedes usar:

```bash
nano .env
```

Reemplaza el valor de `POSTGRES_PASSWORD` por la contraseña que generaste con `openssl`. El archivo `.env` debe quedar con esta forma:

```dotenv
POSTGRES_DB=shopp
POSTGRES_USER=shopp_app
POSTGRES_PASSWORD=PEGA_AQUI_LA_CONTRASEÑA_GENERADA
API_PORT=3000
```

En `nano`, guarda con `Ctrl+O`, pulsa `Enter` y sal con `Ctrl+X`.

Mantén el valor de ejemplo en `.env.example`; la contraseña real debe estar solo en `.env`. No compartas ni subas `.env` a Git. La plantilla incluye `.env` en `.gitignore`.

## 4. Construir e iniciar los servicios

Desde la carpeta que contiene `docker-compose.yml`, ejecuta:

```bash
docker compose up -d --build
```

Comprueba el estado:

```bash
docker compose ps
```

Consulta los registros de la API:

```bash
docker compose logs -f api
```

Pulsa `Ctrl+C` para dejar de ver los registros. Esto no detiene los contenedores.

## 5. Comprobar la API

La API queda disponible en `http://localhost:3000`.

Comprueba que Node.js puede conectarse a PostgreSQL:

```bash
curl http://localhost:3000/health
```

La respuesta esperada es similar a:

```json
{"status":"ok","database":"connected"}
```

La plantilla incluye una tabla de ejemplo llamada `items`. Puedes listar sus registros:

```bash
curl http://localhost:3000/api/items
```

Añade un registro de prueba:

```bash
curl -X POST http://localhost:3000/api/items \
  -H 'Content-Type: application/json' \
  -d '{"name":"Leche"}'
```

Vuelve a consultar la lista para ver el registro:

```bash
curl http://localhost:3000/api/items
```

## 6. Abrir una sesión en PostgreSQL

Entra directamente en `psql` dentro del contenedor:

```bash
docker compose exec db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

En el indicador de `psql` puedes ejecutar, por ejemplo:

```sql
\dt
SELECT * FROM items;
```

Para salir de `psql`:

```text
\q
```

## 7. Parar o volver a iniciar el servidor

Para parar y eliminar los contenedores sin borrar la base de datos:

```bash
docker compose down
```

Para volver a iniciarlos:

```bash
docker compose up -d
```

Los datos de PostgreSQL persisten en el volumen Docker `postgres_data`, incluso después de parar los contenedores.

## 8. Borrar la base de datos y sus datos

Este comando elimina los contenedores y el volumen con todos los datos almacenados:

```bash
docker compose down -v
```

Úsalo solo si realmente quieres empezar con una base de datos vacía. Al arrancar de nuevo, PostgreSQL creará la base y ejecutará el SQL de inicialización.

## 9. Cambiar el puerto de la API

Para usar otro puerto del equipo, cambia `API_PORT` en `.env`. Por ejemplo:

```dotenv
API_PORT=8080
```

Aplica el cambio recreando los contenedores:

```bash
docker compose up -d
```

La API quedará entonces en `http://localhost:8080`.

## Notas

- PostgreSQL no publica su puerto hacia el equipo; la API se conecta a la base por la red privada de Docker Compose.
- El SQL de `server/sql/001_init.sql` se ejecuta automáticamente solo al inicializar un volumen vacío. Para actualizar una base ya existente, se deben aplicar migraciones.
- Esta plantilla es un punto de partida. Antes de exponer la API a Internet, añade autenticación, HTTPS y un usuario de base de datos con permisos limitados para la aplicación.
