# Shopp · Fase 4 · Vista de sincronización manual

Depende de las fases 1, 2 y 3 y de la versión del repositorio recibida el 28-10-2026.

- Aparece **Sincronizar** en la cabecera de Music Playlist y Classical en la PWA para cuentas no invitadas.
- **Comparar con Convex** consulta el inventario: solo locales, solo remotas y coincidencias que requieren revisión.
- **Subir** permite crear una playlist remota que no existe, con LRC si pasan la validación. Requiere confirmación individual.
- **Importar** solo importa en IndexedDB una playlist que no exista localmente, incluida la letra LRC, transaccionalmente.
- No se sobreescriben IDs existentes; no hay fusión ni sincronización automática.
- Carátulas locales grandes, URLs de archivo y paquetes >350 KB se rechazan; la transferencia con File Storage está pendiente.
- La interfaz nativa no habilita importación por ahora. El botón se muestra solo en modo local web; no afecta P2P ni Chat.

## Comprobación

1. Realizar un respaldo JSON/ZIP en ambos dispositivos.
2. Desplegar Convex dev, regenerar `convex/_generated/api` según el flujo habitual y arrancar PWA en develop.
3. En el Mac, abrir Music Playlist → Sincronizar → Comparar con Convex.
4. Subir únicamente una lista de prueba; verificar que retorna «Solo en Convex» en otro navegador/dispositivo.
5. En el segundo dispositivo, importar explícitamente; comprobar canciones y LRC.
6. Probar IDs iguales y confirmar que se muestran en «Requieren revisión» sin reemplazo.

Advertencia: no se han realizado pruebas de integración contra un despliegue de Convex dev. No publicar en main antes de validarlas.
