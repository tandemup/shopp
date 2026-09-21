import React from "react";
import { useWindowDimensions } from "react-native";

export function useTutorialInlinePreviewAvailable() {
  const { width } = useWindowDimensions();
  return width >= 920;
}

export default function TutorialInlinePreview({ track, visible }) {
  if (!visible || !track) return null;

  const source = track.playlistId
    ? `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(track.playlistId)}&playsinline=1&rel=0&modestbranding=1`
    : track.videoId
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(track.videoId)}?playsinline=1&rel=0&modestbranding=1`
      : null;

  if (!source) return null;

  return React.createElement("iframe", {
    src: source,
    title: "Vista previa del tutorial de YouTube",
    allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    allowFullScreen: true,
    loading: "lazy",
    style: {
      display: "block",
      width: "100%",
      aspectRatio: "16 / 9",
      border: 0,
      backgroundColor: "#020617",
    },
  });
}
