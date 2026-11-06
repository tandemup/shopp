# API local JSON de Biblioteca

`libraryJsonApi.js` es el almacenamiento local de la Biblioteca. En web usa
IndexedDB; en iOS y Android utiliza AsyncStorage. Los datos no se sincronizan
con Convex y cada navegador o dispositivo conserva su propia copia local.

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

La API local conserva las operaciones de listado, edición, importación y
exportación. Usa Exportar JSON e Importar JSON para trasladar la Biblioteca
manualmente entre dispositivos.
