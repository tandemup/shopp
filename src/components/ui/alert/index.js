/**
 * API pública única para los diálogos de Shopp.
 *
 * Las pantallas deben importar los controles desde este archivo y no desde
 * implementaciones internas concretas. Así podremos cambiar el host o los
 * componentes visuales sin modificar todas las pantallas.
 */
export {
  normalizeButtons,
  registerWebDialogListener,
  safeAlert,
  safeConfirm,
  safeMenu,
} from "./safeAlert";

export { default as safeQuestion } from "./safeQuestion";

export { default as DialogHost } from "./DialogHost";
