# 1. Ver en qué commits apareció o cambió un archivo

## git log -- path/al/archivo

## Ejemplo:

git log -- src/main.py

### Esto muestra:

Hash del commit
Autor
Fecha
Mensaje del commit
solo para los commits que afectaron a ese archivo.

## 💡 Opciones útiles:

git log --oneline -- path/al/archivo

git log -p -- path/al/archivo # muestra los cambios (diff) en cada commit

2. Ver el contenido del archivo en un commit específico

Primero obtén el commit_hash con git log, luego:

git show <commit_hash>:path/al/archivo

Ejemplo:

git show a1b2c3d:src/main.py

Esto imprime el contenido exacto del archivo en ese commit, sin cambiar tu working directory.

3. Comparar el archivo entre dos commits
   git diff <commit1> <commit2> -- path/al/archivo

Ejemplo:

git diff a1b2c3d e4f5g6h -- src/main.py

Muestra las diferencias del archivo entre ambos commits.

4. Ver línea por línea quién cambió qué y cuándo (blame)
   git blame path/al/archivo

Ejemplo:

git blame src/main.py

Esto indica:

Commit que modificó cada línea

Autor

Fecha

Ideal para auditoría o debugging.

5. Ver el historial completo, incluso si el archivo fue renombrado
   git log --follow -- path/al/archivo

Muy importante si el archivo cambió de nombre en algún momento.

6. Listar todos los commits donde existía el archivo (resumen rápido)
   git rev-list --all -- path/al/archivo

Devuelve solo los hashes de los commits donde el archivo estuvo presente o fue modificado.

Resumen rápido 🧠
Objetivo Comando
Ver commits del archivo git log -- archivo
Ver contenido en un commit git show hash:archivo
Comparar versiones git diff c1 c2 -- archivo
Ver autor por línea git blame archivo
Seguir renombres git log --follow -- archivo
