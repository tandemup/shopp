# API local JSON de Biblioteca

`libraryJsonApi.js` es el almacenamiento local de la Biblioteca. En web usa
IndexedDB; en iOS y Android utiliza AsyncStorage. `libraryCloudSync.js`
sincroniza una copia por usuario en Convex para compartir los mismos datos entre
Safari, la app web de pantalla de inicio y otros dispositivos.

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

La API local conserva las operaciones de listado y edición. La pantalla de
Biblioteca descarga y combina la copia de la cuenta al abrirse y sube cambios
locales después de un breve intervalo. El servidor autoriza las operaciones con
la sesión y el permiso `library` del usuario.
