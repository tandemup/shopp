# Auditoría de menús y alertas

## Resultado

Todos los menús y alertas de la aplicación pasan por la misma interfaz basada en React Native `Modal`, por lo que comparten aspecto y comportamiento en iOS, Android y Web.

## Punto de entrada

- `components/ui/alert/safeAlert.js`: API pública (`safeAlert`, `safeConfirm`, `safeMenu`).
- `components/ui/alert/DialogHost.js`: host multiplataforma único.
- `components/ui/alert/WebAlertModal.js`: modal visual de alertas (nombre histórico conservado).
- `components/ui/alert/WebContextMenuModal.js`: modal visual de menús (nombre histórico conservado).

## Compatibilidad

Los adaptadores antiguos de `utils/ui` siguen disponibles, pero ahora delegan en la interfaz común. Esto evita romper componentes existentes y evita que vuelvan a aparecer diálogos con estilos diferentes.

## Excepciones deliberadas

`safeAlert.js` conserva los diálogos nativos y del navegador únicamente como respaldo cuando `DialogHost` no está montado. En la aplicación normal no se utilizan porque `DialogHost` está montado en `App.js`.

## Validación

- 158 archivos JavaScript/JSX analizados sintácticamente sin errores.
- No quedan llamadas directas a `Alert.alert`, `window.alert`, `window.confirm` o `window.prompt` fuera del módulo de respaldo.
- La exportación web llegó a la fase de empaquetado de Metro, pero no finalizó dentro del límite de ejecución. Los avisos observados proceden de las rutas de imágenes de `leaflet.css` y no de estos cambios.
