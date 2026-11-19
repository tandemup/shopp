#!/bin/bash
set -euo pipefail

# Ejecutar desde la carpeta raíz de Shopp: la que contiene package.json y convex/.
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/shopp-node-postgres"
SERVER_ENV="$SERVER_DIR/.env"
LOCAL_API="http://localhost:3001"

fail() { printf '\nERROR: %s\n' "$1" >&2; exit 1; }

[[ -f "$ROOT_DIR/package.json" && -d "$ROOT_DIR/convex" ]] || fail \
  "Coloca este fichero en la raíz de Shopp, junto a package.json y la carpeta convex/."
[[ -d "$SERVER_DIR" ]] || fail "No encuentro la carpeta shopp-node-postgres dentro de Shopp."
[[ -f "$SERVER_DIR/compose.yml" || -f "$SERVER_DIR/docker-compose.yml" ]] || fail "No encuentro el archivo de Docker Compose dentro de shopp-node-postgres."
command -v npx >/dev/null 2>&1 || fail "No encuentro npx. Instala/activa Node.js primero."
command -v docker >/dev/null 2>&1 || fail "No encuentro Docker. Abre Docker Desktop y vuelve a ejecutar el fichero."
command -v curl >/dev/null 2>&1 || fail "No encuentro curl."
command -v openssl >/dev/null 2>&1 || fail "No encuentro openssl."
command -v python3 >/dev/null 2>&1 || fail "No encuentro python3."

printf 'Iniciando/actualizando Express y PostgreSQL con Docker Compose...\n'
(cd "$SERVER_DIR" && docker compose up -d --build api)
printf 'Esperando a que Express responda en %s ...\n' "$LOCAL_API"
for attempt in {1..30}; do
  if curl -fsS --max-time 2 "$LOCAL_API/health" >/dev/null 2>&1; then break; fi
  if [[ "$attempt" -eq 30 ]]; then fail "Express no respondió en localhost:3001 tras 30 intentos."; fi
  sleep 2
done
printf 'Express responde localmente.\n\n'

printf 'Introduce la URL HTTPS pública del túnel o servidor que llega al puerto 3001.\n'
printf 'No pongas localhost ni una IP privada; ejemplo: https://tu-subdominio.example\n'
read -r -p 'URL pública de Express: ' PUBLIC_URL
PUBLIC_URL="${PUBLIC_URL%/}"
[[ "$PUBLIC_URL" == https://* ]] || fail "La URL debe comenzar por https://."
[[ "$PUBLIC_URL" != *localhost* && "$PUBLIC_URL" != *127.0.0.1* ]] || fail \
  "Convex en la nube no puede llamar a localhost; usa una URL HTTPS pública."
printf 'Verificando %s/health ...\n' "$PUBLIC_URL"
curl -fsS --max-time 15 "$PUBLIC_URL/health" >/dev/null || fail \
  "La URL pública no responde en /health. Comprueba el túnel y que apunta al puerto 3001."

BRIDGE_SECRET="$(openssl rand -hex 32)"
printf '\nSe generó un secreto nuevo. No lo compartas ni lo pegues en chats.\n'

# Guarda el mismo secreto en el .env del backend sin mostrarlo ni sobrescribir otras variables.
SERVER_ENV="$SERVER_ENV" BRIDGE_SECRET="$BRIDGE_SECRET" python3 - <<'PY'
import os
from pathlib import Path
path = Path(os.environ["SERVER_ENV"])
secret = os.environ["BRIDGE_SECRET"]
path.parent.mkdir(parents=True, exist_ok=True)
text = path.read_text() if path.exists() else ""
lines = text.splitlines()
replacement = f"CONVEX_NODE_BRIDGE_SECRET={secret}"
found = False
out = []
for line in lines:
    if line.startswith("CONVEX_NODE_BRIDGE_SECRET="):
        if not found:
            out.append(replacement)
            found = True
    else:
        out.append(line)
if not found:
    out.append(replacement)
path.write_text("\n".join(out) + "\n")
os.chmod(path, 0o600)
PY

printf '\nConfigurando variables en el despliegue Convex asociado a este proyecto...\n'
npx convex env set SHOPP_NODE_API_URL "$PUBLIC_URL"
printf '%s\n' "$BRIDGE_SECRET" | npx convex env set CONVEX_NODE_BRIDGE_SECRET
unset BRIDGE_SECRET

printf '\nReiniciando la API para que lea el secreto actualizado...\n'
(cd "$SERVER_DIR" && docker compose up -d --force-recreate api)

printf '\nComprobando las variables (solo se mostrarán nombres):\n'
ENV_NAMES="$(npx convex env list --names-only)"
printf '%s\n' "$ENV_NAMES"
printf '%s\n' "$ENV_NAMES" | grep -qx 'SHOPP_NODE_API_URL' || fail \
  "Convex no muestra SHOPP_NODE_API_URL. Revisa el despliegue seleccionado."
printf '%s\n' "$ENV_NAMES" | grep -qx 'CONVEX_NODE_BRIDGE_SECRET' || fail \
  "Convex no muestra CONVEX_NODE_BRIDGE_SECRET. Revisa el despliegue seleccionado."

printf '\nConfiguración terminada.\n'
printf 'En otra terminal, desde la raíz de Shopp, inicia Expo con: npx expo start --web -c\n'
printf 'El secreto del servidor queda guardado en: %s\n' "$SERVER_ENV"
