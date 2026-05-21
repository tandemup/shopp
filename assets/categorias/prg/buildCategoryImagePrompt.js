export function buildCategoryImagePrompt(item) {
  const values = {
    formato: item.formato,
    categoria: item.categoria,
    subcategorias: item.subcategorias.join(", "),
    numero_productos: item.composicion.numero_productos,
    estilo_general: item.estilo.general,
    estilo_uso: item.estilo.uso,
    bordes: item.estilo.bordes,
    sombras: item.estilo.sombras,
    colores: item.estilo.colores,
    fondo: item.fondo,
    ancho: item.ancho,
    alto: item.alto,
    relacion_aspecto: item.relacion_aspecto,
    ocupacion_lienzo: item.composicion.ocupacion_lienzo,
  };

  return item.prompt.join(" ").replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) {
      throw new Error(`Variable no definida en el prompt: {{${key}}}`);
    }

    return values[key];
  });
}
