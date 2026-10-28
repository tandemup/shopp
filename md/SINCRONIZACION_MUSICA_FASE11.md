# Fase 11 — Contrato validado de paquetes Music/Classical

## Alcance
Refuerza las operaciones manuales `musicSync.uploadManual` y `musicSync.readSnapshot` y los métodos de `completeTransfer` con un validador compartido. Mantiene el protocolo `shopp-music-sync-package` versión 1 y el esquema de la fase 3, sin migraciones de tablas.

Se rechazan paquetes con IDs inconsistentes, claves LRC duplicadas o huérfanas, letras ausentes, pistas malformadas, carátulas de rutas locales y tamaños superiores a los límites. Para carátulas se admiten URLs HTTPS o imágenes data URI PNG/JPEG/WebP dentro del límite total. Se conserva el control CAS `expectedRevision` de Convex.

## Integración
Requiere las fases 1–10. Copiar estos archivos en la raíz del proyecto y ejecutar `node --test tests/musicSync/phase11.test.mjs`. Ejecutar `npx convex dev` en entorno de pruebas para validar el módulo y las reglas con la versión real de Convex. No ejecutar contra producción sin respaldo.

## Limitaciones
No hay todavía escritura integral del coordinador de fase 9 ni recuperación automática. No se prueba ningún servidor Convex ni un navegador real en esta entrega. Las carátulas locales y los ficheros grandes necesitan una fase separada con Convex File Storage. El cliente nativo sigue sin importación LRC atómica. La activación de sincronización automática permanece bloqueada.

## Prueba manual recomendada (en desarrollo)
1. Exportar ZIP/JSON antes de tocar datos. 2. Subir manualmente una playlist de prueba con una letra y carátula HTTPS desde Mac. 3. Consultar su snapshot autenticado en Convex dev. 4. Importarla en un perfil de navegador de prueba vacío. 5. Verificar pista, orden, LRC y carátula. 6. Probar revisión desactualizada: debe devolver `conflict`. 7. Probar una segunda cuenta: no debe ver los datos de la primera.
