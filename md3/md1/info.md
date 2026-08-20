# Guía para usar GitHub con VS Code en macOS

## 1. Verificar o instalar Git

En macOS normalmente Git ya viene instalado.

1.  Abre **Terminal**.

2.  Ejecuta:

    ``` bash
    git --version
    ```

3.  Si no está instalado, macOS ofrecerá instalar las *Command Line
    Tools*. Acepta.

------------------------------------------------------------------------

## 2. Crear un repositorio en GitHub

1.  Entra a **https://github.com** e inicia sesión.
2.  Haz clic en **+ → New repository**.
3.  Completa:
    -   **Repository name**
    -   **Descripción** (opcional)
4.  Selecciona **Public** o **Private**.
5.  (Opcional pero recomendado) Marca **Add a README**.
6.  Haz clic en **Create repository**.

Copia la URL que se generará, por ejemplo:

    https://github.com/tu-usuario/tu-repo.git

------------------------------------------------------------------------

## 3. Clonar el repositorio en tu Mac

### Opción A: Desde VS Code

1.  Abre **VS Code**.
2.  Presiona: **⌘ + Shift + P**
3.  Busca: **Git: Clone**
4.  Pega la URL del repositorio.
5.  Elige la carpeta donde se guardará.
6.  Selecciona **Open** para abrir el proyecto.

### Opción B: Desde Terminal

``` bash
cd ~/Documents
git clone https://github.com/tu-usuario/tu-repo.git
code tu-repo
```

> Si `code` no funciona: - Ve a VS Code → **Command Palette** - Ejecuta:
> *Shell Command: Install 'code' command in PATH*

------------------------------------------------------------------------

## 4. Realizar cambios, hacer commit y subirlos (push)

1.  Modifica archivos normalmente en VS Code.

2.  Ve a la pestaña **Source Control** (icono de rama).

3.  **Stage**: Presiona el icono **+** junto a cada archivo o **Stage
    All Changes**.

4.  **Commit**: Escribe un mensaje, por ejemplo:

        Inicialización del proyecto

    Luego presiona ✔ **Commit**.

5.  **Push**: Desde los tres puntos (⋯) selecciona **Push**\
    O desde Terminal:

    ``` bash
    git push
    ```

------------------------------------------------------------------------

## 5. Descargar cambios (pull)

Si alguien más hizo cambios o trabajas desde otra máquina:

En VS Code: - Source Control → **Pull**

O desde Terminal:

``` bash
git pull
```

------------------------------------------------------------------------

## 6. Configurar Git (solo la primera vez)

``` bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu-email@ejemplo.com"
```

------------------------------------------------------------------------

## 📌 Flujo básico resumido

1.  Crear repo en GitHub\
2.  Clonar en VS Code\
3.  Editar → **stage** → **commit** → **push**\
4.  Hacer **pull** para obtener cambios
