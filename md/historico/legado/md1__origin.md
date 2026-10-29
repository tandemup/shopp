# Comandos de Git: Remote `origin`

## ¿Qué es `origin`?

`origin` es el nombre por defecto que Git asigna al repositorio remoto
cuando clonas un proyecto. Es simplemente un alias que apunta a la URL
del repositorio.

------------------------------------------------------------------------

## Comandos esenciales

### Ver los remotos configurados

``` bash
git remote -v
```

### Agregar un remoto llamado origin

``` bash
git remote add origin <url>
```

### Cambiar la URL del remoto origin

``` bash
git remote set-url origin <nueva-url>
```

### Eliminar el remoto origin

``` bash
git remote remove origin
```

------------------------------------------------------------------------

## Descargar y subir cambios

### Descargar cambios sin fusionar

``` bash
git fetch origin
```

### Descargar y fusionar cambios

``` bash
git pull origin <rama>
```

### Subir cambios al remoto

``` bash
git push origin <rama>
```

Para publicar una rama nueva:

``` bash
git push -u origin mi-rama
```

------------------------------------------------------------------------

## Ramas remotas

### Ver ramas remotas

``` bash
git branch -r
```

### Ver ramas locales y remotas

``` bash
git branch -a
```

### Crear una rama basada en una rama remota

``` bash
git checkout -b mi-rama origin/mi-rama
```
