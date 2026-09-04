# Configurar GitHub en macOS: Tokens, Credenciales y VS Code

Estás en lo correcto: GitHub eliminó el uso de contraseñas para Git y
ahora todo se hace mediante **tokens personales (PAT)** o **GitHub
CLI**.\
Como usas **Mac**, aquí tienes los pasos exactos para configurar tus
credenciales correctamente.

------------------------------------------------------------------------

## 🔧 1. Crear un token personal (PAT) en GitHub

1.  Ve a GitHub → **Settings**
2.  Entra a **Developer settings**
3.  Selecciona **Personal access tokens → Tokens (classic)**
4.  Clic en **Generate new token**
5.  Marca los permisos necesarios:
    -   `repo`
    -   `workflow` (opcional)
6.  Copia el token (solo lo verás una vez).

------------------------------------------------------------------------

## 🔧 2. Limpiar credenciales viejas desde macOS

Git almacena credenciales en el **Keychain (Llavero)**.

1.  Abre **Keychain Access (Acceso a llavero)**

2.  En la búsqueda escribe:

        github

3.  Busca entradas como:

    -   `git:https://github.com`
    -   `github.com`

4.  **Elimínalas** (clic derecho → Delete)

Esto fuerza a Git a pedir el token nuevamente.

------------------------------------------------------------------------

## 🔧 3. Configurar Git con tu usuario

En VS Code o la terminal:

``` bash
git config --global user.name "TuUsuarioGitHub"
git config --global user.email "tucorreo@ejemplo.com"
```

------------------------------------------------------------------------

## 🔧 4. Forzar a Git a pedir el token nuevo

En el proyecto ejecuta:

``` bash
git pull
```

o:

``` bash
git push
```

Git solicitará:

-   **Username:** tu usuario de GitHub\
-   **Password:** pega tu **token personal** (no la contraseña).

> Si no te lo pide, aún quedan credenciales viejas en el llavero.

------------------------------------------------------------------------

## 🔧 5. Alternativa más sencilla: GitHub CLI

Puedes evitar gestionar tokens manuales si usas GitHub CLI.

### Instalar:

``` bash
brew install gh
```

### Iniciar sesión:

``` bash
gh auth login
```

Selecciona: - GitHub.com\
- HTTPS\
- Autenticación mediante navegador

Y listo, tus credenciales quedan gestionadas automáticamente.

------------------------------------------------------------------------

## ✔️ Confirmación

Prueba:

``` bash
git push
git pull
```

Si ya no pide credenciales y funciona correctamente, todo está
configurado.

------------------------------------------------------------------------

## 💬 ¿Necesitas ayuda adicional?

Puedo ayudarte a:

-   Configurar GitHub CLI paso a paso\
-   Crear o clonar repositorios\
-   Subir un proyecto local a GitHub\
-   Resolver errores específicos de Git o VS Code
