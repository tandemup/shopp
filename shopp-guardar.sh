#!/usr/bin/env bash
# Guarda y publica los cambios de Shopp en develop.
# Uso: ./shopp-guardar.sh "Descripción de los cambios"
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo 'ERROR: Ejecuta este script dentro del repositorio de Shopp.' >&2
  exit 1
fi

branch="$(git branch --show-current)"
if [[ "$branch" != "develop" ]]; then
  echo "ERROR: Estás en '$branch'. Cambia a develop antes de ejecutar el script." >&2
  echo 'Si tienes cambios sin guardar, guárdalos o usa git stash antes de cambiar de rama.' >&2
  exit 1
fi

if [[ -z "$(git status --porcelain)" ]]; then
  echo 'No hay cambios locales que guardar.'
  exit 0
fi

mensaje="${*:-}"
if [[ -z "$mensaje" ]]; then
  read -r -p 'Mensaje del commit: ' mensaje
fi
if [[ -z "${mensaje//[[:space:]]/}" ]]; then
  echo 'ERROR: El mensaje del commit no puede estar vacío.' >&2
  exit 1
fi

echo '--- Resumen de cambios ---'
git status --short
read -r -p '¿Añadir TODOS estos cambios (git add -A) y continuar? [s/N] ' confirmar
case "$confirmar" in
  s|S|si|Si|SI|sí|Sí|SÍ) ;;
  *) echo 'Operación cancelada.'; exit 0 ;;
esac

# Primero se confirma el trabajo local; así los cambios no quedan expuestos
# a un pull/merge con archivos sin guardar.
git add -A
if git diff --cached --quiet; then
  echo 'No hay cambios preparados para confirmar.'
  exit 0
fi
git commit -m "$mensaje"

echo '--- Sincronizando develop con GitHub ---'
git fetch origin develop
if ! git merge --ff-only origin/develop; then
  echo 'Las ramas local y remota han divergido. No se ha realizado el push.' >&2
  echo 'Revisa el historial y decide cómo integrar los cambios:' >&2
  echo '  git log --oneline --graph --decorate --all -15' >&2
  exit 1
fi

git push origin develop
printf '\nCambios publicados en origin/develop. Para pasar a main, abre una Pull Request en GitHub.\n'
