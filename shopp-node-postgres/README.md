# Servidor Node.js + Docker + PostgreSQL

Plantilla inicial: API REST en Express, PostgreSQL 17 y Docker Compose. La API ofrece `GET /health`, `GET /api/items` y `POST /api/items` como ejemplo de conexión y persistencia.

## Requisitos

- Docker Desktop (Mac/Windows) o Docker Engine con el complemento `docker compose`.
- Puertos 3000 y el puerto interno de PostgreSQL (no publicado al host por defecto).

## Arranque

Desde la carpeta `shopp-node-postgres`:

```bash
cp .env.example .env
```

Edita `.env` y sustituye `POSTGRES_PASSWORD` por una contraseña larga y aleatoria. Después:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

La API queda en `http://localhost:3000`. Comprueba:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/items
curl -X POST http://localhost:3000/api/items \
  -H 'Content-Type: application/json' \
  -d '{"name":"Leche"}'
```

## PostgreSQL

La base y el usuario se crean al inicializar el volumen por primera vez. La tabla `items` también se crea automáticamente desde `server/sql/001_init.sql`.

Entrar con `psql` dentro del contenedor:

```bash
docker compose exec db sh
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

O abrir `psql` directamente:

```bash
docker compose exec db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

La base de datos conserva sus datos en el volumen Docker `postgres_data`. Para parar los contenedores sin borrar datos:

```bash
docker compose down
```

Para borrar también todos los datos persistidos (acción irreversible):

```bash
docker compose down -v
```

## Ajustes importantes

- La contraseña está en `.env`, que está excluido de Git. No la subas al repositorio.
- PostgreSQL no publica su puerto en Internet. La API se comunica con la base por la red privada de Compose.
- `API_PORT` cambia el puerto accesible en el equipo, por ejemplo `API_PORT=8080`.
- SQL inicial solo se ejecuta cuando el volumen de datos está vacío. Para cambios posteriores, añade migraciones y aplícalas explícitamente.
- Antes de exponer la API públicamente, añade autenticación, HTTPS mediante proxy inverso y límites de peticiones.
