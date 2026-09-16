import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { exclusivePlayback } from "@/src/services/exclusivePlayback";
import { youtubeError } from "./youtubeUtils";

let apiPromise;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    let done = false;
    const previous = window.onYouTubeIframeAPIReady;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      resolve(window.YT);
    };
    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("YouTube tarda en responder. Comprueba tu conexión y pulsa Reintentar."));
    }, 20000);
    window.onYouTubeIframeAPIReady = () => { try { previous?.(); } finally { finish(); } };
    let script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => { clearTimeout(timeout); done = true; script.remove(); reject(new Error("No se pudo conectar con YouTube.")); };
      document.head.appendChild(script);
    }
  }).catch((error) => { apiPromise = null; throw error; });
  return apiPromise;
}

// Only this component owns an iframe. Resizing/minimizing does not recreate it.
export default forwardRef(function YouTubeSurface({
  track,
  initialTime = 0,
  initialPlaylistIndex = 0,
  autoPlay = false,
  initialVolume = 100,
  onStatus,
}, ref) {
  const host = useRef(null);
  const commands = useRef({});
  const statusCallback = useRef(onStatus);
  statusCallback.current = onStatus;
  useImperativeHandle(ref, () => ({
    play: () => commands.current.play?.(),
    pause: () => commands.current.pause?.(),
    seek: (time) => commands.current.seek?.(time),
    selectVideo: (index) => commands.current.selectVideo?.(index),
    setVolume: (value) => commands.current.setVolume?.(value),
  }), []);
  useEffect(() => {
    const id = Symbol("youtube");
    let player;
    let disposed = false;
    let ready = false;
    let granted = false;
    let action = 0;
    let timer;
    const node = document.createElement("div");
    const container = host.current;
    container.replaceChildren(node);
    const emit = (extra = {}) => {
      if (disposed) return;
      const data = ready ? player.getVideoData?.() || {} : {};
      statusCallback.current?.({
        ready, time: ready ? player.getCurrentTime?.() || 0 : 0,
        duration: ready ? player.getDuration?.() || 0 : 0,
        state: ready ? player.getPlayerState?.() : -1,
        videoId: data.video_id || "", videoTitle: data.title || "",
        videoIds: ready ? player.getPlaylist?.() || [] : [],
        playlistIndex: ready ? Math.max(0, player.getPlaylistIndex?.() || 0) : 0,
        ...extra,
      });
    };
    const suspend = async () => {
      action += 1;
      granted = false;
      if (ready) { player.mute(); player.pauseVideo(); }
      emit({ state: 2 });
      // YouTube commands use postMessage; wait for silence before another iframe unmutes.
      for (let attempt = 0; ready && !disposed && attempt < 80; attempt += 1) {
        if (player.isMuted() || [0, 2, 5, -1].includes(player.getPlayerState())) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      if (ready && !disposed && !player.isMuted()) throw new Error("Unable to pause YouTube");
    };
    const unregister = exclusivePlayback.register(id, suspend);
    // Reserve the user's latest selection now, not when a delayed API load completes.
    exclusivePlayback.claim(id).catch(() => emit({ error: "No se pudo pausar el otro reproductor." }));
    const requestPlay = async (select) => {
      if (!ready || disposed) return;
      const ticket = ++action;
      const startPlayback = () => {
        if (typeof select === "number") player.playVideoAt(select);
        else if (player.getPlayerState() !== 1) player.playVideo();
        player.unMute();
      };
      // This surface normally already owns the single global playback
      // session. Start synchronously so Chrome keeps the user activation
      // associated with the Play button and permits unmuted playback.
      if (exclusivePlayback.owns(id)) {
        granted = true;
        startPlayback();
        emit({ state: 1 });
        return;
      }
      try {
        const allowed = await exclusivePlayback.claim(id);
        if (!allowed || ticket !== action || disposed) return;
        granted = true;
        startPlayback();
      } catch {
        if (!disposed) { suspend().catch(() => {}); emit({ error: "No se pudo pausar el otro reproductor. Inténtalo de nuevo." }); }
      }
    };
    commands.current = {
      play: () => requestPlay(), pause: () => suspend().catch(() => {}),
      seek: (time) => { if (ready) { player.seekTo(Math.max(0, time), true); emit(); } },
      selectVideo: (index) => requestPlay(index),
      setVolume: (value) => { if (ready) player.setVolume(Math.max(0, Math.min(100, value))); },
    };
    emit();
    loadApi().then((YT) => {
      if (disposed) return;
      player = new YT.Player(node, {
        width: "100%", height: "100%", videoId: track.videoId || undefined,
        playerVars: {
          autoplay: 0,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
          ...(initialTime > 0 ? { start: Math.floor(initialTime) } : {}),
          ...(track.kind === "album"
            ? {
                listType: "playlist",
                list: track.playlistId,
                index: Math.max(0, initialPlaylistIndex),
              }
            : {}),
        },
        events: {
          onReady: () => {
            if (disposed) return;
            ready = true;
            player.setVolume(Math.max(0, Math.min(100, initialVolume)));
            player.mute();
            if (initialTime > 0) player.seekTo(initialTime, true);
            emit();
            timer = setInterval(() => emit(), 500);
            // La pista siguiente se crea después de que termine la anterior.
            // En ese momento la reclamación asíncrona puede no haber terminado
            // todavía, por lo que requestPlay debe encargarse de reclamarla.
            if (autoPlay) requestPlay();
          },
          onStateChange: ({ data }) => {
            if (disposed || !ready) return;
            // A paused iframe is muted before it can be started again using YouTube's controls.
            if (data === 1 && (!granted || !exclusivePlayback.owns(id))) {
              player.mute(); requestPlay();
            }
            if (data === 2 || data === 0) { action += 1; granted = false; player.mute(); }
            emit();
          },
          onAutoplayBlocked: () => emit({ state: 2, notice: "Pulsa reproducir para iniciar el vídeo." }),
          onError: ({ data }) => { if (!disposed) { suspend().catch(() => {}); emit({ error: youtubeError(data) }); } },
        },
      });
    }).catch((error) => emit({ error: error.message }));
    return () => {
      disposed = true;
      action += 1;
      unregister();
      clearInterval(timer);
      commands.current = {};
      try { player?.destroy(); } catch {}
      container.replaceChildren();
    };
  }, [
    track.videoId,
    track.playlistId,
    track.kind,
    initialTime,
    initialPlaylistIndex,
    autoPlay,
  ]);
  return <div ref={host} style={{ width: "100%", height: "100%", background: "#000" }} />;
});
