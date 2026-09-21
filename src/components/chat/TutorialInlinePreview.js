// En iOS y Android el reproductor global de Shopp abre el vídeo. El iframe
// solo se usa en web, donde puede mostrarse dentro de una tarjeta amplia.
export function useTutorialInlinePreviewAvailable() {
  return false;
}

export default function TutorialInlinePreview() {
  return null;
}
