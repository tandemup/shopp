import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { I18nText as Text } from "@/src/i18n";

const COLORS = {
  background: "#F4F7FB",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  text: "#172033",
  textMuted: "#667085",
  textSoft: "#98A2B3",
  border: "#E4E7EC",
  red: "#DC2626",
  redDark: "#B91C1C",
  redSoft: "#FEE2E2",
  green: "#15803D",
  greenSoft: "#ECFDF3",
  amber: "#B45309",
  amberSoft: "#FFF7ED",
  blue: "#2563EB",
  blueSoft: "#EAF2FF",
  purple: "#7C3AED",
  purpleSoft: "#F3E8FF",
};

const ADVISORS = [
  {
    id: "admin",
    label: "Administrador",
    subtitle: "Aviso principal",
    icon: "shield-checkmark-outline",
    color: COLORS.red,
    backgroundColor: COLORS.redSoft,
  },
  {
    id: "hero",
    label: "Fire Hero",
    subtitle: "Contacto de confianza",
    icon: "flash-outline",
    color: COLORS.blue,
    backgroundColor: COLORS.blueSoft,
  },
  {
    id: "rescue",
    label: "Rescue",
    subtitle: "Segundo contacto",
    icon: "heart-circle-outline",
    color: COLORS.purple,
    backgroundColor: COLORS.purpleSoft,
  },
];

const FIREALARM_TURN_URL =
  typeof process !== "undefined"
    ? process.env.EXPO_PUBLIC_FIREALARM_TURN_URL
    : undefined;
const FIREALARM_TURN_USERNAME =
  typeof process !== "undefined"
    ? process.env.EXPO_PUBLIC_FIREALARM_TURN_USERNAME
    : undefined;
const FIREALARM_TURN_CREDENTIAL =
  typeof process !== "undefined"
    ? process.env.EXPO_PUBLIC_FIREALARM_TURN_CREDENTIAL
    : undefined;

const TURN_CONFIGURED = Boolean(
  FIREALARM_TURN_URL && FIREALARM_TURN_USERNAME && FIREALARM_TURN_CREDENTIAL,
);

function buildIceServers() {
  const servers = [{ urls: "stun:stun.l.google.com:19302" }];

  if (TURN_CONFIGURED) {
    servers.push({
      urls: FIREALARM_TURN_URL,
      username: FIREALARM_TURN_USERNAME,
      credential: FIREALARM_TURN_CREDENTIAL,
    });
  }

  return servers;
}

function formatVideoStats(stats) {
  if (!stats?.width || !stats?.height) return "";
  const fps = stats.fps ? ` · ${Math.round(stats.fps)} fps` : "";
  return `${stats.width} × ${stats.height}${fps}`;
}

function StatusPill({ active }) {
  return (
    <View
      style={[
        styles.statusPill,
        active ? styles.statusActive : styles.statusIdle,
      ]}
    >
      <View
        style={[styles.statusDot, active ? styles.dotActive : styles.dotIdle]}
      />
      <Text
        style={[
          styles.statusText,
          active ? styles.statusTextActive : styles.statusTextIdle,
        ]}
      >
        {active ? "Cámara activa" : "Cámara detenida"}
      </Text>
    </View>
  );
}

function AdvisorButton({ advisor, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.advisorButton,
        selected && styles.advisorButtonSelected,
        pressed && styles.buttonPressed,
      ]}
    >
      <View
        style={[
          styles.advisorAvatar,
          { backgroundColor: advisor.backgroundColor },
        ]}
      >
        <Ionicons name={advisor.icon} size={28} color={advisor.color} />
      </View>
      <View style={styles.advisorBody}>
        <Text style={styles.advisorLabel}>{advisor.label}</Text>
        <Text style={styles.advisorSubtitle}>{advisor.subtitle}</Text>
      </View>
      <Ionicons
        name={selected ? "checkmark-circle" : "chevron-forward"}
        size={22}
        color={selected ? COLORS.red : COLORS.textSoft}
      />
    </Pressable>
  );
}

function AlarmStatus({ status }) {
  const config = {
    pending: ["Pendiente", COLORS.red, COLORS.redSoft],
    acknowledged: ["Recibida", COLORS.amber, COLORS.amberSoft],
    resolved: ["Resuelta", COLORS.green, COLORS.greenSoft],
    cancelled: ["Cancelada", COLORS.textMuted, COLORS.surfaceMuted],
  }[status] ?? [status, COLORS.textMuted, COLORS.surfaceMuted];

  return (
    <View style={[styles.alarmStatus, { backgroundColor: config[2] }]}>
      <Text style={[styles.alarmStatusText, { color: config[1] }]}>
        {config[0]}
      </Text>
    </View>
  );
}

function formatAlarmDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function WebRtcFireAlarmAdminContent() {
  const currentUser = useQuery(api.users.current);
  const isAdmin = currentUser?.isAdmin === true;

  const myAlarms = useQuery(api.fireAlarm.listMine, currentUser ? {} : "skip");
  const adminAlarms = useQuery(
    api.fireAlarm.listActiveForAdmin,
    currentUser && isAdmin ? {} : "skip",
  );

  const generateUploadUrl = useMutation(
    api.fireAlarm.generateSnapshotUploadUrl,
  );
  const createRemoteAlarm = useMutation(api.fireAlarm.create);
  const cancelRemoteAlarm = useMutation(api.fireAlarm.cancelMine);
  const acknowledgeAlarm = useMutation(api.fireAlarm.acknowledge);
  const resolveAlarm = useMutation(api.fireAlarm.resolve);
  const sendRtcSignal = useMutation(api.fireAlarm.sendRtcSignal);

  const videoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const streamRef = useRef(null);
  const peerRef = useRef(null);
  const processedSignalIdsRef = useRef(new Set());
  const rtcStatsTimerRef = useRef(null);

  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [selectedAdvisor, setSelectedAdvisor] = useState("admin");
  const [sending, setSending] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState(null);
  const [rtcAlarmId, setRtcAlarmId] = useState(null);
  const [rtcRole, setRtcRole] = useState(null);
  const [rtcStatus, setRtcStatus] = useState("idle");
  const [rtcTransport, setRtcTransport] = useState("unknown");
  const [localVideoStats, setLocalVideoStats] = useState(null);
  const [remoteVideoStats, setRemoteVideoStats] = useState(null);

  const rtcSignals = useQuery(
    api.fireAlarm.listRtcSignals,
    currentUser && rtcAlarmId ? { alarmId: rtcAlarmId } : "skip",
  );

  const selectedAdvisorData = useMemo(
    () => ADVISORS.find((item) => item.id === selectedAdvisor) ?? ADVISORS[0],
    [selectedAdvisor],
  );

  const stopRtcStatsMonitor = useCallback(() => {
    if (rtcStatsTimerRef.current) {
      clearInterval(rtcStatsTimerRef.current);
      rtcStatsTimerRef.current = null;
    }
  }, []);

  const inspectPeerStats = useCallback(async (peer, role) => {
    if (!peer?.getStats) return;

    try {
      const reports = await peer.getStats();
      let selectedPair = null;
      let inboundVideo = null;

      reports.forEach((report) => {
        if (
          report.type === "candidate-pair" &&
          report.state === "succeeded" &&
          (report.selected || report.nominated)
        ) {
          selectedPair = report;
        }

        if (
          report.type === "inbound-rtp" &&
          report.kind === "video" &&
          !report.isRemote
        ) {
          inboundVideo = report;
        }
      });

      if (!selectedPair) {
        reports.forEach((report) => {
          if (
            report.type === "transport" &&
            report.selectedCandidatePairId &&
            reports.get(report.selectedCandidatePairId)
          ) {
            selectedPair = reports.get(report.selectedCandidatePairId);
          }
        });
      }

      if (selectedPair) {
        const localCandidate = reports.get(selectedPair.localCandidateId);
        const remoteCandidate = reports.get(selectedPair.remoteCandidateId);
        const candidateType =
          localCandidate?.candidateType || remoteCandidate?.candidateType;

        if (candidateType === "relay") {
          setRtcTransport("TURN relay");
        } else if (candidateType === "srflx") {
          setRtcTransport("P2P / STUN");
        } else if (candidateType === "host") {
          setRtcTransport("P2P local");
        } else if (candidateType) {
          setRtcTransport(`P2P / ${candidateType}`);
        }
      }

      if (
        role === "admin" &&
        inboundVideo?.frameWidth &&
        inboundVideo?.frameHeight
      ) {
        setRemoteVideoStats({
          width: inboundVideo.frameWidth,
          height: inboundVideo.frameHeight,
          fps: inboundVideo.framesPerSecond || null,
        });
      }
    } catch (statsError) {
      console.warn("[WebRtcFireAlarm] stats error", statsError);
    }
  }, []);

  const startRtcStatsMonitor = useCallback(
    (peer, role) => {
      stopRtcStatsMonitor();
      const tick = () => inspectPeerStats(peer, role);
      tick();
      rtcStatsTimerRef.current = setInterval(tick, 2000);
    },
    [inspectPeerStats, stopRtcStatsMonitor],
  );

  const closePeerConnection = useCallback(() => {
    stopRtcStatsMonitor();

    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    processedSignalIdsRef.current = new Set();
    setRtcAlarmId(null);
    setRtcRole(null);
    setRtcStatus("idle");
    setRtcTransport("unknown");
    setRemoteVideoStats(null);
  }, [stopRtcStatsMonitor]);

  const createPeerConnection = useCallback(
    (alarmId, role) => {
      if (Platform.OS !== "web" || !globalThis?.RTCPeerConnection) {
        throw new Error("Este navegador no ofrece RTCPeerConnection.");
      }

      if (peerRef.current) {
        peerRef.current.close();
      }

      processedSignalIdsRef.current = new Set();

      const peer = new RTCPeerConnection({
        iceServers: buildIceServers(),
      });

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;

        sendRtcSignal({
          alarmId,
          type: "ice",
          payload: JSON.stringify(event.candidate.toJSON()),
        }).catch((signalError) => {
          console.warn("[WebRtcFireAlarm] ICE signal error", signalError);
        });
      };

      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;
        setRtcStatus(state || "connecting");

        if (state === "connected") {
          startRtcStatsMonitor(peer, role);
        } else if (
          state === "failed" ||
          state === "closed" ||
          state === "disconnected"
        ) {
          stopRtcStatsMonitor();
        }
      };

      peer.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteVideoRef.current && remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play?.().catch(() => {});
        }
      };

      if (role === "camera") {
        const stream = streamRef.current;
        if (!stream) {
          throw new Error("La cámara debe estar activa para iniciar WebRTC.");
        }

        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      }

      peerRef.current = peer;
      setRtcAlarmId(alarmId);
      setRtcRole(role);
      setRtcStatus("connecting");

      return peer;
    },
    [sendRtcSignal, startRtcStatsMonitor, stopRtcStatsMonitor],
  );

  const startCameraWebRtc = useCallback(
    async (alarmId) => {
      const peer = createPeerConnection(alarmId, "camera");
      const offer = await peer.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });

      await peer.setLocalDescription(offer);

      await sendRtcSignal({
        alarmId,
        type: "offer",
        payload: JSON.stringify(offer),
      });
    },
    [createPeerConnection, sendRtcSignal],
  );

  const openAdminLiveVideo = useCallback(
    async (alarmId) => {
      setError("");

      try {
        createPeerConnection(alarmId, "admin");
      } catch (rtcError) {
        console.warn("[WebRtcFireAlarm] admin WebRTC error", rtcError);
        setError(rtcError?.message || "No se pudo iniciar WebRTC.");
      }
    },
    [createPeerConnection],
  );

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
    setLocalVideoStats(null);
  }, []);

  const startCamera = useCallback(async () => {
    setError("");

    if (Platform.OS !== "web") {
      setError(
        "Esta fase usa la cámara Web/PWA. La cámara nativa se añadirá después.",
      );
      return;
    }

    if (!globalThis?.navigator?.mediaDevices?.getUserMedia) {
      setError(
        "El navegador no ofrece acceso compatible a la cámara mediante getUserMedia().",
      );
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks?.()[0];
      const settings = videoTrack?.getSettings?.() || {};
      if (settings.width && settings.height) {
        setLocalVideoStats({
          width: settings.width,
          height: settings.height,
          fps: settings.frameRate || null,
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play?.();
      }
      setActive(true);
    } catch (cameraError) {
      console.warn("[WebRtcFireAlarm] camera error", cameraError);
      setError(
        "No se pudo abrir la cámara. Comprueba permisos y usa localhost o HTTPS.",
      );
    }
  }, [stopCamera]);

  const captureSnapshot = useCallback(() => {
    if (Platform.OS !== "web" || !videoRef.current) return null;

    const video = videoRef.current;
    const sourceWidth = video.videoWidth || 0;
    const sourceHeight = video.videoHeight || 0;
    if (!sourceWidth || !sourceHeight) return null;

    const maxWidth = 640;
    const scale = Math.min(1, maxWidth / sourceWidth);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context?.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.78);
  }, []);

  const sendAlarm = useCallback(async () => {
    setError("");

    if (!currentUser) {
      setError("Debes iniciar sesión para enviar una alarma.");
      return;
    }

    if (!active) {
      setError("Activa primero la cámara para verificar la escena.");
      return;
    }

    const snapshot = captureSnapshot();
    if (!snapshot) {
      setError(
        "La cámara está activa, pero todavía no hay una imagen disponible.",
      );
      return;
    }

    setSending(true);

    try {
      const uploadUrl = await generateUploadUrl({});
      const blob = await fetch(snapshot).then((response) => response.blob());
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error("No se pudo subir la captura.");
      }

      const { storageId } = await uploadResponse.json();

      const result = await createRemoteAlarm({
        advisorId: selectedAdvisorData.id,
        advisorLabel: selectedAdvisorData.label,
        snapshotStorageId: storageId,
      });

      setLastSnapshot(snapshot);

      if (result?.alarmId) {
        await startCameraWebRtc(result.alarmId);
      }
    } catch (alarmError) {
      console.warn("[WebRtcFireAlarm] alarm error", alarmError);
      setError(alarmError?.message || "No se pudo enviar la alarma.");
    } finally {
      setSending(false);
    }
  }, [
    active,
    captureSnapshot,
    createRemoteAlarm,
    currentUser,
    generateUploadUrl,
    selectedAdvisorData,
    startCameraWebRtc,
  ]);

  useEffect(
    () => () => {
      stopCamera();
      closePeerConnection();
    },
    [closePeerConnection, stopCamera],
  );

  useEffect(() => {
    if (!rtcSignals || !peerRef.current || !rtcRole) return;

    let cancelled = false;

    async function applySignals() {
      const peer = peerRef.current;
      if (!peer) return;

      for (const signal of rtcSignals) {
        if (
          cancelled ||
          processedSignalIdsRef.current.has(String(signal._id))
        ) {
          continue;
        }

        const isRemoteSignal =
          (rtcRole === "camera" && signal.senderRole === "admin") ||
          (rtcRole === "admin" && signal.senderRole === "camera");

        if (!isRemoteSignal) {
          processedSignalIdsRef.current.add(String(signal._id));
          continue;
        }

        try {
          if (signal.type === "offer" && rtcRole === "admin") {
            const offer = JSON.parse(signal.payload);

            if (!peer.remoteDescription) {
              await peer.setRemoteDescription(offer);

              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);

              await sendRtcSignal({
                alarmId: rtcAlarmId,
                type: "answer",
                payload: JSON.stringify(answer),
              });
            }
          } else if (signal.type === "answer" && rtcRole === "camera") {
            const answer = JSON.parse(signal.payload);
            if (!peer.remoteDescription) {
              await peer.setRemoteDescription(answer);
            }
          } else if (signal.type === "ice") {
            if (!peer.remoteDescription) {
              continue;
            }

            await peer.addIceCandidate(JSON.parse(signal.payload));
          }

          processedSignalIdsRef.current.add(String(signal._id));
        } catch (signalError) {
          console.warn("[WebRtcFireAlarm] apply signal error", signalError);
        }
      }
    }

    applySignals();

    return () => {
      cancelled = true;
    };
  }, [rtcAlarmId, rtcRole, rtcSignals, sendRtcSignal]);

  const alarmsToShow = isAdmin ? adminAlarms : myAlarms;

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="flame" size={27} color="#FFFFFF" />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.title}>WebRTC Fire Alarm</Text>
            <Text style={styles.subtitle}>
              Verificación visual de incendios con cámara y alarmas en tiempo
              real mediante Convex.
            </Text>
          </View>
          <StatusPill active={active} />
        </View>

        <View style={styles.modeCard}>
          <View style={styles.modeIcon}>
            <Ionicons
              name={isAdmin ? "shield-checkmark-outline" : "person-outline"}
              size={21}
              color={isAdmin ? COLORS.red : COLORS.blue}
            />
          </View>
          <View style={styles.modeBody}>
            <Text style={styles.modeTitle}>
              {isAdmin ? "Modo administrador" : "Modo vigilancia"}
            </Text>
            <Text style={styles.modeText}>
              {isAdmin
                ? "Las alarmas activas de otros usuarios aparecen aquí automáticamente."
                : "Activa la cámara y envía una alarma para que el administrador pueda verificarla."}
            </Text>
          </View>
        </View>

        <View style={styles.videoCard}>
          {Platform.OS === "web" ? (
            <video
              ref={videoRef}
              muted
              playsInline
              style={{
                width: "100%",
                aspectRatio: "16 / 9",
                objectFit: "cover",
                background: "#111827",
              }}
            />
          ) : (
            <View style={styles.nativePlaceholder}>
              <Ionicons
                name="videocam-outline"
                size={46}
                color={COLORS.textMuted}
              />
              <Text style={styles.nativePlaceholderText}>
                Vista de cámara Web/PWA
              </Text>
            </View>
          )}

          <View style={styles.videoFooter}>
            <View style={styles.videoFooterText}>
              <Text style={styles.cameraLabel}>Cámara local</Text>
              <Text style={styles.cameraMeta}>
                La cámara permanece local hasta enviar una alarma. Después se
                negocia una conexión WebRTC y Convex solo transporta
                señalización.
              </Text>
              {localVideoStats ? (
                <Text style={styles.cameraStats}>
                  Resolución real: {formatVideoStats(localVideoStats)}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={active ? stopCamera : startCamera}
              style={({ pressed }) => [
                styles.cameraButton,
                active && styles.cameraButtonStop,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons
                name={active ? "stop-circle-outline" : "videocam-outline"}
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.cameraButtonText}>
                {active ? "Detener" : "Activar"}
              </Text>
            </Pressable>
          </View>
        </View>

        {isAdmin && rtcAlarmId ? (
          <View style={styles.remoteVideoCard}>
            <View style={styles.remoteVideoHeader}>
              <View>
                <Text style={styles.remoteVideoTitle}>
                  Cámara remota en directo
                </Text>
                <Text style={styles.remoteVideoMeta}>
                  WebRTC · estado: {rtcStatus} · {rtcTransport}
                </Text>
                {remoteVideoStats ? (
                  <Text style={styles.remoteVideoMeta}>
                    Vídeo recibido: {formatVideoStats(remoteVideoStats)}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={closePeerConnection}
                style={({ pressed }) => [
                  styles.remoteCloseButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.remoteCloseButtonText}>Cerrar</Text>
              </Pressable>
            </View>

            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: "100%",
                aspectRatio: "16 / 9",
                objectFit: "cover",
                background: "#111827",
              }}
            />
          </View>
        ) : null}

        {!isAdmin && rtcAlarmId ? (
          <View style={styles.rtcStatusCard}>
            <Ionicons name="radio-outline" size={20} color={COLORS.blue} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rtcStatusTitle}>WebRTC preparado</Text>
              <Text style={styles.rtcStatusText}>
                Esperando al administrador · estado: {rtcStatus}
              </Text>
              <Text style={styles.rtcStatusText}>
                ICE: {TURN_CONFIGURED ? "STUN + TURN configurado" : "solo STUN"}
              </Text>
            </View>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={21} color={COLORS.amber} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!isAdmin ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>¿A quién avisamos?</Text>
              <Text style={styles.sectionSubtitle}>
                De momento todos los avisos llegan al backend; después
                vincularemos cada opción con usuarios reales.
              </Text>
            </View>

            <View style={styles.advisorsGrid}>
              {ADVISORS.map((advisor) => (
                <AdvisorButton
                  key={advisor.id}
                  advisor={advisor}
                  selected={selectedAdvisor === advisor.id}
                  onPress={() => setSelectedAdvisor(advisor.id)}
                />
              ))}
            </View>

            <Pressable
              disabled={sending}
              onPress={sendAlarm}
              style={({ pressed }) => [
                styles.fireButton,
                sending && styles.disabledButton,
                pressed && !sending && styles.buttonPressed,
              ]}
            >
              <Ionicons name="flame" size={25} color="#FFFFFF" />
              <View style={styles.fireButtonBody}>
                <Text style={styles.fireButtonTitle}>
                  {sending ? "ENVIANDO ALARMA..." : "AVISAR DE INCENDIO"}
                </Text>
                <Text style={styles.fireButtonText}>
                  Envía una captura y crea una alarma en Convex
                </Text>
              </View>
            </Pressable>
          </>
        ) : null}

        {lastSnapshot && !isAdmin ? (
          <View style={styles.snapshotCard}>
            <Text style={styles.snapshotTitle}>Última captura enviada</Text>
            <Image
              source={{ uri: lastSnapshot }}
              style={styles.snapshotImage}
              resizeMode="cover"
            />
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {isAdmin ? "Alarmas activas" : "Mis alarmas"}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {isAdmin
              ? "Esta lista se actualiza en tiempo real mientras la pantalla está abierta."
              : "Historial reciente de alarmas enviadas desde tu cuenta."}
          </Text>
        </View>

        {alarmsToShow === undefined ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Cargando alarmas...</Text>
          </View>
        ) : alarmsToShow.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No hay alarmas.</Text>
          </View>
        ) : (
          alarmsToShow.map((item) => (
            <View key={String(item._id)} style={styles.alarmCard}>
              {item.snapshotUrl ? (
                <Image
                  source={{ uri: item.snapshotUrl }}
                  style={styles.alarmImage}
                  resizeMode="cover"
                />
              ) : null}
              <View style={styles.alarmContent}>
                <View style={styles.alarmHeaderRow}>
                  <View style={styles.alarmTitleBlock}>
                    <Text style={styles.alarmTitle}>
                      {item.createdByAlias || "Usuario"}
                    </Text>
                    <Text style={styles.alarmMeta}>
                      {formatAlarmDate(item.createdAt)} · {item.advisorLabel}
                    </Text>
                  </View>
                  <AlarmStatus status={item.status} />
                </View>

                <View style={styles.alarmActions}>
                  {isAdmin &&
                  (item.status === "pending" ||
                    item.status === "acknowledged") ? (
                    <Pressable
                      onPress={() => openAdminLiveVideo(item._id)}
                      style={({ pressed }) => [
                        styles.liveAction,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Ionicons
                        name="videocam-outline"
                        size={17}
                        color="#FFFFFF"
                      />
                      <Text style={styles.liveActionText}>
                        Ver cámara en directo
                      </Text>
                    </Pressable>
                  ) : null}

                  {isAdmin && item.status === "pending" ? (
                    <Pressable
                      onPress={() => acknowledgeAlarm({ alarmId: item._id })}
                      style={({ pressed }) => [
                        styles.secondaryAction,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={styles.secondaryActionText}>
                        Confirmar recepción
                      </Text>
                    </Pressable>
                  ) : null}

                  {isAdmin &&
                  (item.status === "pending" ||
                    item.status === "acknowledged") ? (
                    <Pressable
                      onPress={() => resolveAlarm({ alarmId: item._id })}
                      style={({ pressed }) => [
                        styles.resolveAction,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={styles.resolveActionText}>Resolver</Text>
                    </Pressable>
                  ) : null}

                  {!isAdmin &&
                  (item.status === "pending" ||
                    item.status === "acknowledged") ? (
                    <Pressable
                      onPress={() => cancelRemoteAlarm({ alarmId: item._id })}
                      style={({ pressed }) => [
                        styles.cancelAction,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={styles.cancelActionText}>Cancelar</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          ))
        )}

        <View style={styles.turnCard}>
          <View style={styles.turnHeader}>
            <Ionicons
              name={TURN_CONFIGURED ? "cloud-done-outline" : "cloud-outline"}
              size={21}
              color={TURN_CONFIGURED ? COLORS.green : COLORS.amber}
            />
            <Text style={styles.turnTitle}>Conectividad WebRTC</Text>
          </View>
          <Text style={styles.turnText}>
            STUN: activo · TURN:{" "}
            {TURN_CONFIGURED ? "configurado" : "no configurado"}
          </Text>
          <Text style={styles.turnText}>
            {TURN_CONFIGURED
              ? "Si la conexión P2P falla, WebRTC puede utilizar el relay TURN."
              : "La conexión depende por ahora de P2P/STUN. Algunas redes móviles, CGNAT o firewalls pueden bloquearla."}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Estado del desarrollo</Text>
          <Text style={styles.infoText}>✓ Cámara Web/PWA</Text>
          <Text style={styles.infoText}>✓ Captura JPEG</Text>
          <Text style={styles.infoText}>✓ Alarmas persistentes en Convex</Text>
          <Text style={styles.infoText}>
            ✓ Recepción en tiempo real para administrador
          </Text>
          <Text style={styles.infoText}>
            ✓ Señalización WebRTC mediante Convex
          </Text>
          <Text style={styles.infoText}>
            ✓ Vídeo P2P en directo con STUN (prototipo)
          </Text>
          <Text style={styles.infoText}>
            ✓ Soporte TURN configurable mediante variables de entorno
          </Text>
          <Text style={styles.infoText}>
            Siguiente: pruebas de conectividad y servicio TURN de producción.
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          Fire Alarm es una ayuda de vigilancia y verificación visual. No
          sustituye sistemas certificados de detección de incendios ni los
          procedimientos oficiales de emergencia.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function WebRtcFireAlarmScreen() {
  const currentUser = useQuery(api.users.current);

  if (currentUser === undefined) {
    return (
      <SafeAreaView
        edges={["left", "right", "bottom"]}
        style={styles.accessSafeArea}
      >
        <Text style={styles.accessText}>Comprobando permisos…</Text>
      </SafeAreaView>
    );
  }

  if (currentUser?.isAdmin !== true) {
    return (
      <SafeAreaView
        edges={["left", "right", "bottom"]}
        style={styles.accessSafeArea}
      >
        <View style={styles.accessCard}>
          <Ionicons name="lock-closed-outline" size={30} color={COLORS.red} />
          <Text style={styles.accessTitle}>Acceso restringido</Text>
          <Text style={styles.accessText}>
            Fire Alarm es una utilidad DEV disponible únicamente para
            administradores.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return <WebRtcFireAlarmAdminContent />;
}

const styles = StyleSheet.create({
  accessSafeArea: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  accessCard: {
    width: "100%",
    maxWidth: 440,
    padding: 24,
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
  },
  accessTitle: {
    marginTop: 12,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },
  accessText: {
    marginTop: 8,
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: {
    width: "100%",
    maxWidth: 920,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 80,
  },
  hero: {
    padding: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
  },
  heroIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.red,
    borderRadius: 16,
  },
  heroText: { flex: 1, minWidth: 220 },
  title: { color: COLORS.text, fontSize: 23, fontWeight: "900" },
  subtitle: {
    marginTop: 4,
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  statusPill: {
    minHeight: 32,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
  },
  statusActive: { backgroundColor: COLORS.greenSoft },
  statusIdle: { backgroundColor: "#F2F4F7" },
  statusDot: { width: 8, height: 8, marginRight: 7, borderRadius: 4 },
  dotActive: { backgroundColor: COLORS.green },
  dotIdle: { backgroundColor: COLORS.textMuted },
  statusText: { fontSize: 11, fontWeight: "800" },
  statusTextActive: { color: COLORS.green },
  statusTextIdle: { color: COLORS.textMuted },
  modeCard: {
    marginTop: 12,
    padding: 14,
    flexDirection: "row",
    gap: 11,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
  },
  modeIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 12,
  },
  modeBody: { flex: 1 },
  modeTitle: { color: COLORS.text, fontSize: 14, fontWeight: "900" },
  modeText: {
    marginTop: 3,
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  videoCard: {
    marginTop: 14,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
  },
  nativePlaceholder: {
    aspectRatio: 16 / 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  nativePlaceholderText: {
    marginTop: 8,
    color: COLORS.textMuted,
    fontWeight: "700",
  },
  videoFooter: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  videoFooterText: { flex: 1 },
  cameraLabel: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  cameraMeta: {
    marginTop: 3,
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  cameraStats: {
    marginTop: 4,
    color: COLORS.blue,
    fontSize: 11,
    fontWeight: "800",
  },
  cameraButton: {
    minHeight: 42,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: COLORS.red,
    borderRadius: 13,
  },
  cameraButtonStop: { backgroundColor: COLORS.text },
  cameraButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  errorCard: {
    marginTop: 12,
    padding: 13,
    flexDirection: "row",
    gap: 9,
    backgroundColor: COLORS.amberSoft,
    borderRadius: 15,
  },
  errorText: {
    flex: 1,
    color: COLORS.amber,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  sectionHeader: { marginTop: 22, marginBottom: 10 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  sectionSubtitle: {
    marginTop: 4,
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  advisorsGrid: { gap: 9 },
  advisorButton: {
    minHeight: 68,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
  },
  advisorButtonSelected: { borderColor: COLORS.red },
  advisorAvatar: {
    width: 46,
    height: 46,
    marginRight: 11,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  advisorBody: { flex: 1 },
  advisorLabel: { color: COLORS.text, fontSize: 14, fontWeight: "900" },
  advisorSubtitle: { marginTop: 2, color: COLORS.textMuted, fontSize: 11 },
  fireButton: {
    marginTop: 16,
    minHeight: 66,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: COLORS.red,
    borderRadius: 18,
  },
  fireButtonBody: { flex: 1 },
  fireButtonTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  fireButtonText: {
    marginTop: 3,
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
  },
  disabledButton: { opacity: 0.55 },
  buttonPressed: { opacity: 0.82 },
  snapshotCard: {
    marginTop: 14,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
  },
  snapshotTitle: {
    padding: 12,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },
  snapshotImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#111827",
  },
  emptyCard: {
    padding: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
  },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: "center" },
  alarmCard: {
    marginBottom: 10,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
  },
  alarmImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#111827",
  },
  alarmContent: { padding: 13 },
  alarmHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  alarmTitleBlock: { flex: 1 },
  alarmTitle: { color: COLORS.text, fontSize: 15, fontWeight: "900" },
  alarmMeta: { marginTop: 3, color: COLORS.textMuted, fontSize: 11 },
  alarmStatus: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 },
  alarmStatusText: { fontSize: 10, fontWeight: "900" },
  alarmActions: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  secondaryAction: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: COLORS.amberSoft,
    borderRadius: 11,
  },
  secondaryActionText: { color: COLORS.amber, fontSize: 11, fontWeight: "800" },
  resolveAction: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: COLORS.greenSoft,
    borderRadius: 11,
  },
  resolveActionText: { color: COLORS.green, fontSize: 11, fontWeight: "800" },
  cancelAction: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: COLORS.redSoft,
    borderRadius: 11,
  },
  cancelActionText: { color: COLORS.red, fontSize: 11, fontWeight: "800" },
  infoCard: {
    marginTop: 18,
    padding: 17,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
  },
  infoTitle: {
    marginBottom: 8,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },
  infoText: {
    marginTop: 5,
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  turnCard: {
    marginTop: 18,
    padding: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
  },
  turnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 7,
  },
  turnTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
  },
  turnText: {
    marginTop: 3,
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 17,
  },
  remoteVideoCard: {
    marginTop: 14,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
  },
  remoteVideoHeader: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  remoteVideoTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
  },
  remoteVideoMeta: {
    marginTop: 3,
    color: COLORS.textMuted,
    fontSize: 11,
  },
  remoteCloseButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 11,
  },
  remoteCloseButtonText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  rtcStatusCard: {
    marginTop: 12,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.blueSoft,
    borderRadius: 15,
  },
  rtcStatusTitle: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: "900",
  },
  rtcStatusText: {
    marginTop: 2,
    color: COLORS.textMuted,
    fontSize: 11,
  },
  liveAction: {
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.blue,
    borderRadius: 11,
  },
  liveActionText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  disclaimer: {
    marginTop: 18,
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
});
