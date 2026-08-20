# Funcionalidades actuales

## Compras

El usuario crea listas, añade artículos, modifica cantidad/unidad/precio, marca artículos comprados, aplica promociones y consulta listas archivadas e histórico. Los totales se calculan con la lógica de `src/utils/pricing`.

## Productos y escáner

El escáner reconoce códigos EAN, permite buscar información, editar productos y guardar el resultado. El sistema diferencia el historial personal, la caché de productos y las contribuciones/revisiones que requieren aprobación administrativa.

## Tiendas y mapas

Convex mantiene las tiendas y favoritos. La aplicación puede mostrar información, horarios, distancia, ubicación cercana y mapas. La implementación visual se adapta entre Web y plataformas nativas.

## Chat

El chat se ejecuta mediante Convex, no mediante Socket.IO. Los mensajes se agrupan por sala; se aplican controles de contenido y seguridad de URL. Convex incluye funciones de moderación, ocultación/bloqueo y limpieza de mensajes expirados. `YesterdayNewsScreen` puede utilizar audio local para las noticias; esto no equivale a una sección musical de álbumes.

## Parking

El usuario selecciona un destino y puede indicar estados como búsqueda, aparcado, salida o cancelación. Se comparten posiciones y plazas potenciales con otros usuarios según las reglas del backend. Las pantallas GPS de diagnóstico son herramientas administrativas, no el flujo normal.

## Cuenta y administración

Convex Auth controla la sesión. El perfil puede contener alias y teléfono opcional. Las funciones administrativas están protegidas en el backend y permiten gestionar usuarios, revisar productos y ejecutar tareas de mantenimiento.
