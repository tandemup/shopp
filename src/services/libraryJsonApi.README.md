# API local JSON de Biblioteca

`libraryJsonApi.js` sustituye la persistencia de enlaces y categorías en Convex.
En web escribe el documento JSON en IndexedDB; en iOS y Android utiliza la capa
local de Shopp basada en AsyncStorage.

Operaciones incluidas: listado y búsqueda paginada, carpetas, altas, edición,
favoritos, movimiento, archivado, importación (`combine`/`replace`), exportación
y reinicio. Todas las escrituras se serializan para evitar que dos operaciones
simultáneas sobrescriban datos.

```js
import { libraryJsonApi } from "@/src/services/libraryJsonApi";

const page = await libraryJsonApi.list({ search: "estructuras", limit: 80 });
await libraryJsonApi.addUrl({ url: "https://example.com", folderId });
const backup = await libraryJsonApi.exportBackup();
await libraryJsonApi.importBackup(backup, { mode: "combine" });
```

La API no abre conexiones con Convex. El siguiente paso de integración consiste
en cambiar los hooks `useQuery`/`useMutation` de `LibraryScreen.js` por llamadas
a esta API y su método `subscribe`.
