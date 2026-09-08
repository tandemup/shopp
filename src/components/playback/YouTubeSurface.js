import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { WebView } from "react-native-webview";
import { exclusivePlayback } from "@/src/services/exclusivePlayback";
import { buildNativeYouTubeHtml } from "./nativeYouTubeHtml";
import { youtubeError } from "./youtubeUtils";

let nextSession = 0;
export default forwardRef(function YouTubeSurface({
  track,
  initialTime = 0,
  initialPlaylistIndex = 0,
  autoPlay = false,
  onStatus,
}, ref) {
  const web = useRef(null);
  const pending = useRef(new Map());
  const id = useRef(Symbol("youtube-native")).current;
  const session = useMemo(() => `shopp-${++nextSession}`, [track.videoId, track.playlistId, track.kind]);
  const source = useMemo(
    () => ({
      html: buildNativeYouTubeHtml(
        track,
        session,
        initialTime,
        initialPlaylistIndex,
        autoPlay,
      ),
      baseUrl: "https://www.youtube.com",
    }),
    [session, initialTime, initialPlaylistIndex, autoPlay],
  );
  const alive = useRef(false);
  const requestNumber = useRef(0);
  const command = (name, value, requestId) => web.current?.injectJavaScript(
    `window.shoppCommand&&window.shoppCommand(${JSON.stringify(name)},${JSON.stringify(value ?? null)},${JSON.stringify(requestId ?? null)});true;`,
  );
  const suspend = () => new Promise((resolve, reject) => {
    if (!alive.current || !web.current) { resolve(); return; }
    const requestId = ++requestNumber.current;
    const timer = setTimeout(() => { pending.current.delete(requestId); reject(new Error("Pause acknowledgement timed out")); }, 2500);
    pending.current.set(requestId, { resolve, reject, timer });
    command("suspend", null, requestId);
  });
  useImperativeHandle(ref, () => ({
    play: () => command("play"),
    pause: () => suspend().catch(() => {}),
    seek: (time) => command("seek", time),
    selectVideo: (index) => command("select", index),
  }));
  useEffect(() => {
    alive.current = true;
    const unregister = exclusivePlayback.register(id, suspend);
    exclusivePlayback.claim(id).catch(() => onStatus?.({ error: "No se pudo pausar el otro reproductor." }));
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") suspend().catch(() => {});
    });
    return () => {
      alive.current = false;
      unregister();
      subscription.remove();
      for (const { resolve, timer } of pending.current.values()) { clearTimeout(timer); resolve(); }
      pending.current.clear();
    };
  }, [session]);
  const onMessage = async (event) => {
    let data;
    try { data = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (!alive.current || data.session !== session) return;
    if (data.type === "ack") {
      const item = pending.current.get(data.requestId);
      if (item) {
        clearTimeout(item.timer); pending.current.delete(data.requestId);
        if (data.error) item.reject(new Error("Unable to pause")); else item.resolve();
      }
    } else if (data.type === "claim") {
      if (data.initial && !exclusivePlayback.owns(id)) return;
      try {
        if (await exclusivePlayback.claim(id) && alive.current) command("grant", { ticket: data.ticket, index: data.index });
      } catch {
        onStatus?.({ state: 2, error: "No se pudo pausar el otro reproductor. Inténtalo de nuevo." });
      }
    } else if (data.type === "error") onStatus?.({ state: 2, error: youtubeError(data.code) });
    else if (data.type === "status") onStatus?.(data);
  };
  return <WebView key={session} ref={web} source={source} onMessage={onMessage}
    allowsFullscreenVideo allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
    onError={() => onStatus?.({ error: "No se pudo conectar con YouTube." })}
    style={{ flex: 1, backgroundColor: "#000" }} />;
});
