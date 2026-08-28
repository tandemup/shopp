import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { I18nText as Text } from "@/src/i18n";

const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const DATA_CHANNEL_LABEL = "shopp-live-data";

function Video({ videoRef, muted = false }) {
  return React.createElement("video", {
    ref: videoRef,
    autoPlay: true,
    playsInline: true,
    muted,
    controls: !muted,
    style: styles.video,
  });
}

function normalizeRtcMessage(rawValue) {
  const receivedAt = Date.now();
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === "object") {
      return {
        ...parsed,
        receivedAt,
      };
    }
  } catch {
    // Los mensajes de texto plano también son válidos.
  }
  return {
    type: "MESSAGE",
    text: String(rawValue),
    timestamp: receivedAt,
    receivedAt,
  };
}

function bindDataChannel(channel, { onMessage, onReady }) {
  if (!channel) return () => {};

  const send = (message) => {
    if (channel.readyState !== "open") {
      throw new Error("El canal de datos WebRTC todavía no está conectado.");
    }
    const payload =
      typeof message === "string"
        ? message
        : JSON.stringify({ timestamp: Date.now(), ...message });
    channel.send(payload);
  };

  channel.onopen = () => onReady?.(send, true);
  channel.onclose = () => onReady?.(null, false);
  channel.onerror = () => onReady?.(null, false);
  channel.onmessage = (event) => onMessage?.(normalizeRtcMessage(event.data));

  if (channel.readyState === "open") onReady?.(send, true);

  return () => {
    channel.onopen = null;
    channel.onclose = null;
    channel.onerror = null;
    channel.onmessage = null;
    onReady?.(null, false);
  };
}

function BroadcasterPeer({
  session,
  stream,
  onDataMessage,
  onDataChannelReady,
}) {
  const answerSession = useMutation(api.live.answerCameraSession);
  const addCandidate = useMutation(api.live.addCameraIceCandidate);
  const remoteCandidates = useQuery(api.live.listCameraIceCandidates, {
    sessionId: session._id,
    side: "viewer",
  });
  const peerRef = useRef(null);
  const dataCleanupRef = useRef(null);
  const appliedRef = useRef(new Set());
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    if (!stream || session.answer) return undefined;
    let cancelled = false;
    const peer = new RTCPeerConnection(RTC_CONFIG);
    peerRef.current = peer;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.ondatachannel = (event) => {
      if (event.channel?.label !== DATA_CHANNEL_LABEL) return;
      dataCleanupRef.current?.();
      dataCleanupRef.current = bindDataChannel(event.channel, {
        onMessage: (message) =>
          onDataMessage?.({ ...message, peerSessionId: session._id }),
        onReady: (send, connected) =>
          onDataChannelReady?.(session._id, send, connected),
      });
    };

    peer.onicecandidate = ({ candidate }) => {
      if (!candidate || cancelled) return;
      addCandidate({
        sessionId: session._id,
        side: "broadcaster",
        candidate: JSON.stringify(candidate.toJSON()),
      }).catch(() => {});
    };

    (async () => {
      try {
        await peer.setRemoteDescription(JSON.parse(session.offer));
        if (cancelled) return;
        setRemoteReady(true);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await answerSession({
          sessionId: session._id,
          answer: JSON.stringify(peer.localDescription),
        });
      } catch {
        peer.close();
      }
    })();

    return () => {
      cancelled = true;
      dataCleanupRef.current?.();
      dataCleanupRef.current = null;
      onDataChannelReady?.(session._id, null, false);
      peer.close();
      peerRef.current = null;
    };
  }, [
    addCandidate,
    answerSession,
    onDataChannelReady,
    onDataMessage,
    session._id,
    session.offer,
    stream,
  ]);

  useEffect(() => {
    const peer = peerRef.current;
    if (!peer || !remoteReady || !remoteCandidates) return;
    remoteCandidates.forEach((item) => {
      if (appliedRef.current.has(item._id)) return;
      appliedRef.current.add(item._id);
      peer.addIceCandidate(JSON.parse(item.candidate)).catch(() => {});
    });
  }, [remoteCandidates, remoteReady]);

  return null;
}

export function CameraBroadcaster({
  channelId,
  onError,
  onStreamReady,
  onDataMessage,
  onDataSenderReady,
}) {
  const sessions = useQuery(api.live.listCameraSessions, { channelId });
  const videoRef = useRef(null);
  const dataSendersRef = useRef(new Map());
  const [stream, setStream] = useState(null);

  useEffect(() => {
    const broadcastSend = (message) => {
      const senders = Array.from(dataSendersRef.current.values());
      if (senders.length === 0) {
        throw new Error("No hay espectadores conectados al canal de datos.");
      }
      senders.forEach((send) => send(message));
    };
    onDataSenderReady?.(
      dataSendersRef.current.size ? broadcastSend : null,
      dataSendersRef.current.size > 0,
    );
  }, [onDataSenderReady]);

  const handleDataChannelReady = useCallback(
    (sessionId, send, connected) => {
      if (connected && send) dataSendersRef.current.set(sessionId, send);
      else dataSendersRef.current.delete(sessionId);

      const broadcastSend = (message) => {
        const senders = Array.from(dataSendersRef.current.values());
        if (senders.length === 0) {
          throw new Error("No hay espectadores conectados al canal de datos.");
        }
        senders.forEach((sender) => sender(message));
      };
      onDataSenderReady?.(
        dataSendersRef.current.size ? broadcastSend : null,
        dataSendersRef.current.size > 0,
      );
    },
    [onDataSenderReady],
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !navigator.mediaDevices?.getUserMedia) {
      onError?.(new Error("Este dispositivo no ofrece acceso web a la cámara."));
      return undefined;
    }
    let localStream;
    let cancelled = false;
    (async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        });
        if (cancelled) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }
        setStream(localStream);
        if (videoRef.current) videoRef.current.srcObject = localStream;
        onStreamReady?.();
      } catch (error) {
        onError?.(error);
      }
    })();
    return () => {
      cancelled = true;
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, [onError, onStreamReady]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  if (Platform.OS !== "web") {
    return (
      <Text style={styles.message}>La emisión con cámara está disponible en la PWA.</Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Video videoRef={videoRef} muted />
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>
          {stream ? `EMITIENDO · ${sessions?.length || 0}/4` : "PREPARANDO CÁMARA"}
        </Text>
      </View>
      {!stream ? <ActivityIndicator style={styles.loader} color="#FFFFFF" /> : null}
      {stream
        ? sessions?.map((session) => (
            <BroadcasterPeer
              key={session._id}
              session={session}
              stream={stream}
              onDataMessage={onDataMessage}
              onDataChannelReady={handleDataChannelReady}
            />
          ))
        : null}
    </View>
  );
}

export function CameraViewer({
  channelId,
  onError,
  onDataMessage,
  onDataSenderReady,
}) {
  const createSession = useMutation(api.live.createCameraSession);
  const addCandidate = useMutation(api.live.addCameraIceCandidate);
  const leaveSession = useMutation(api.live.leaveCameraSession);
  const heartbeatSession = useMutation(api.live.heartbeatCameraSession);
  const [sessionId, setSessionId] = useState(null);
  const session = useQuery(
    api.live.getCameraSession,
    sessionId ? { sessionId } : "skip",
  );
  const remoteCandidates = useQuery(
    api.live.listCameraIceCandidates,
    sessionId ? { sessionId, side: "broadcaster" } : "skip",
  );
  const videoRef = useRef(null);
  const peerRef = useRef(null);
  const dataCleanupRef = useRef(null);
  const sessionIdRef = useRef(null);
  const queuedCandidatesRef = useRef([]);
  const appliedRef = useRef(new Set());
  const answerAppliedRef = useRef(false);
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return undefined;
    let cancelled = false;
    const peer = new RTCPeerConnection(RTC_CONFIG);
    peerRef.current = peer;
    peer.addTransceiver("video", { direction: "recvonly" });
    peer.addTransceiver("audio", { direction: "recvonly" });

    const dataChannel = peer.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,
    });
    dataCleanupRef.current = bindDataChannel(dataChannel, {
      onMessage: onDataMessage,
      onReady: onDataSenderReady,
    });

    peer.ontrack = ({ streams }) => {
      if (videoRef.current && streams[0]) videoRef.current.srcObject = streams[0];
    };
    peer.onicecandidate = ({ candidate }) => {
      if (!candidate || cancelled) return;
      const value = JSON.stringify(candidate.toJSON());
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) queuedCandidatesRef.current.push(value);
      else {
        addCandidate({
          sessionId: currentSessionId,
          side: "viewer",
          candidate: value,
        }).catch(() => {});
      }
    };

    (async () => {
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        const id = await createSession({
          channelId,
          clientId:
            globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          offer: JSON.stringify(peer.localDescription),
        });
        if (cancelled) {
          leaveSession({ sessionId: id }).catch(() => {});
          return;
        }
        sessionIdRef.current = id;
        setSessionId(id);
        const queued = queuedCandidatesRef.current.splice(0);
        await Promise.all(
          queued.map((candidate) =>
            addCandidate({ sessionId: id, side: "viewer", candidate }),
          ),
        );
      } catch (error) {
        onError?.(error);
      }
    })();

    return () => {
      cancelled = true;
      dataCleanupRef.current?.();
      dataCleanupRef.current = null;
      peer.close();
      peerRef.current = null;
      const id = sessionIdRef.current;
      if (id) leaveSession({ sessionId: id }).catch(() => {});
    };
  }, [
    addCandidate,
    channelId,
    createSession,
    leaveSession,
    onDataMessage,
    onDataSenderReady,
    onError,
  ]);

  useEffect(() => {
    if (!sessionId) return undefined;
    heartbeatSession({ sessionId }).catch(() => {});
    const timer = setInterval(
      () => heartbeatSession({ sessionId }).catch(() => {}),
      10000,
    );
    return () => clearInterval(timer);
  }, [heartbeatSession, sessionId]);

  useEffect(() => {
    const peer = peerRef.current;
    if (!peer || !session?.answer || answerAppliedRef.current) return;
    answerAppliedRef.current = true;
    peer
      .setRemoteDescription(JSON.parse(session.answer))
      .then(() => setRemoteReady(true))
      .catch(onError);
  }, [onError, session?.answer]);

  useEffect(() => {
    const peer = peerRef.current;
    if (!peer || !remoteReady || !remoteCandidates) return;
    remoteCandidates.forEach((item) => {
      if (appliedRef.current.has(item._id)) return;
      appliedRef.current.add(item._id);
      peer.addIceCandidate(JSON.parse(item.candidate)).catch(() => {});
    });
  }, [remoteCandidates, remoteReady]);

  if (Platform.OS !== "web") {
    return <Text style={styles.message}>Abre Shopp como PWA para ver esta cámara.</Text>;
  }

  return (
    <View style={styles.wrap}>
      <Video videoRef={videoRef} />
      {!remoteReady ? (
        <View style={styles.connecting}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.connectingText}>Conectando con la cámara…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  video: { display: "block", width: "100%", height: "100%", objectFit: "cover" },
  statusBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#E11D48",
  },
  statusText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  loader: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  connecting: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
  },
  connectingText: { color: "#FFFFFF", fontWeight: "700" },
  message: { padding: 24, color: "#64748B", textAlign: "center" },
});
