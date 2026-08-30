// src/components/chat/WebPreviewCard.js

import React, { useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isTrustedDomain } from "@/src/services/urlSafety";
import CachedLinkImage from "@/src/components/chat/CachedLinkImage";

const PREVIEW_CARD_MAX_WIDTH = 380;
const PREVIEW_IMAGE_HEIGHT = 260;
const PREVIEW_COMPACT_IMAGE_HEIGHT = 220;
const PREVIEW_DENSE_CARD_WIDTH = 250;
const PREVIEW_DENSE_IMAGE_HEIGHT = 112;

function normalizePreviewUrl(value) {
  const text = String(value || "").trim();

  if (!text) return "";

  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }

  return `https://${text}`;
}

function getHostname(value) {
  try {
    return new URL(normalizePreviewUrl(value)).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function getDomainIconUrl(hostname) {
  const cleanHostname = String(hostname || "")
    .replace(/^www\./i, "")
    .trim()
    .toLowerCase();

  if (!cleanHostname) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanHostname)}&sz=64`;
}

function absolutizeUrl(value, baseUrl) {
  const text = String(value || "").trim();

  if (!text) return "";

  try {
    return new URL(text, baseUrl).toString();
  } catch {
    return "";
  }
}

function getFallbackTitle(url) {
  try {
    const parsed = new URL(normalizePreviewUrl(url));
    const slug = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "")
      .replace(/\.(html?|php)$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\d{4}\b|\b\d{1,2}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : getHostname(url) || "Vista previa";
  } catch {
    return getHostname(url) || "Vista previa";
  }
}

function firstString(...values) {
  for (const value of values) {
    const text = String(value || "").trim();

    if (text) {
      return text;
    }
  }

  return "";
}

function normalizePreviewPayload(data, normalizedUrl) {
  const hostname =
    firstString(data?.hostname, data?.host, getHostname(normalizedUrl)) ||
    getHostname(normalizedUrl);

  const title =
    firstString(
      data?.title,
      data?.ogTitle,
      data?.twitterTitle,
      data?.metaTitle,
      data?.pageTitle,
    ) || getFallbackTitle(normalizedUrl);

  const description = firstString(
    data?.description,
    data?.ogDescription,
    data?.twitterDescription,
    data?.metaDescription,
    data?.summary,
  );

  const rawImage = firstString(
    data?.image,
    data?.imageUrl,
    data?.thumbnail,
    data?.thumbnailUrl,
    data?.ogImage,
    data?.twitterImage,
    Array.isArray(data?.images) ? data.images[0] : "",
  );

  const image = absolutizeUrl(rawImage, normalizedUrl);

  const siteName =
    firstString(data?.siteName, data?.ogSiteName, data?.publisher, hostname) ||
    hostname;

  return {
    url: data?.url || normalizedUrl,
    title,
    description,
    image,
    siteName,
    hostname,
  };
}

export default function WebPreviewCard({
  url,
  compact = false,
  dense = false,
  onPress,
  showDomainIcon = false,
}) {
  const getLinkPreview = useAction(api.linkPreviews.get);
  const normalizedUrl = useMemo(() => normalizePreviewUrl(url), [url]);

  const allowed = useMemo(() => {
    return isTrustedDomain(normalizedUrl);
  }, [normalizedUrl]);

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [failed, setFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [domainIconFailed, setDomainIconFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setPreview(null);
      setFailed(false);
      setImageFailed(false);
      setDomainIconFailed(false);

      if (!normalizedUrl || !allowed) {
        setFailed(true);
        return;
      }

      setLoading(true);

      try {
        const data = await getLinkPreview({ url: normalizedUrl });

        if (cancelled) return;

        setPreview(normalizePreviewPayload(data || {}, normalizedUrl));
      } catch (error) {
        console.warn("No se pudo cargar la vista previa:", error);

        if (!cancelled) {
          setPreview(null);
          setFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [allowed, getLinkPreview, normalizedUrl]);

  const handlePress = async () => {
    if (!allowed) return;

    if (onPress) {
      onPress(normalizedUrl);
      return;
    }

    try {
      const supported = await Linking.canOpenURL(normalizedUrl);

      if (supported) {
        await Linking.openURL(normalizedUrl);
      }
    } catch (error) {
      console.warn("No se pudo abrir la URL:", error);
    }
  };

  if (!normalizedUrl) return null;

  if (loading && !preview) {
    return (
      <View style={[styles.card, compact && styles.cardCompact, dense && styles.cardDense]}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Cargando vista previa...</Text>
        </View>
      </View>
    );
  }

  if (failed || !preview) {
    return (
      <Pressable
        onPress={handlePress}
        disabled={!allowed}
        style={[
          styles.card,
          styles.fallbackCard,
          !allowed && styles.cardBlocked,
          compact && styles.cardCompact,
          dense && styles.cardDense,
        ]}
      >
        <View style={styles.fallbackIconBox}>
          <Text style={styles.fallbackIconText}>↗</Text>
        </View>

        <View style={styles.textBlock}>
          <View style={styles.siteNameRow}>
            {showDomainIcon ? (
              <DomainIcon
                hostname={getHostname(normalizedUrl)}
                failed={domainIconFailed}
                onError={() => setDomainIconFailed(true)}
              />
            ) : null}
            <Text style={styles.siteName} numberOfLines={1}>
              {getHostname(normalizedUrl)}
            </Text>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {getFallbackTitle(normalizedUrl)}
          </Text>

          <Text style={styles.fullUrlText}>{normalizedUrl}</Text>
        </View>

        {!allowed ? (
          <View pointerEvents="none" style={styles.blurOverlay} />
        ) : null}
      </Pressable>
    );
  }

  const shouldShowImage = Boolean(preview.image) && !imageFailed;
  const previewHostname = preview.hostname || getHostname(normalizedUrl);

  return (
    <Pressable
      onPress={handlePress}
      disabled={!allowed}
      style={[
        styles.card,
        !allowed && styles.cardBlocked,
        compact && styles.cardCompact,
        dense && styles.cardDense,
      ]}
    >
      {shouldShowImage ? (
        <CachedLinkImage
          uri={preview.image}
          style={[styles.image, compact && styles.imageCompact, dense && styles.imageDense]}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}

      <View style={[styles.body, dense && styles.bodyDense]}>
        <View style={styles.leftAccent} />

        <View style={styles.textBlock}>
          <View style={styles.siteNameRow}>
            {showDomainIcon ? (
              <DomainIcon
                hostname={previewHostname}
                failed={domainIconFailed}
                onError={() => setDomainIconFailed(true)}
              />
            ) : null}
            <Text style={styles.siteName} numberOfLines={1}>
              {preview.siteName || previewHostname}
            </Text>
          </View>

          <Text style={[styles.title, dense && styles.titleDense]} numberOfLines={dense ? 2 : 3}>
            {preview.title || getFallbackTitle(normalizedUrl)}
          </Text>

          {preview.description ? (
            <Text style={[styles.description, dense && styles.descriptionDense]} numberOfLines={dense ? 1 : 2}>
              {preview.description}
            </Text>
          ) : null}

          <Text style={[styles.fullUrlText, dense && styles.urlDense]} numberOfLines={dense ? 1 : undefined}>
            {preview.url || normalizedUrl}
          </Text>
        </View>
      </View>

      {!allowed ? (
        <View pointerEvents="none" style={styles.blurOverlay} />
      ) : null}
    </Pressable>
  );
}

function DomainIcon({ hostname, failed, onError }) {
  if (failed || !getDomainIconUrl(hostname)) {
    return (
      <View style={styles.domainIconFallback}>
        <Ionicons name="newspaper-outline" size={13} color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.domainIconBox}>
      <CachedLinkImage
        uri={getDomainIconUrl(hostname)}
        style={styles.domainIcon}
        resizeMode="contain"
        onError={onError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: PREVIEW_CARD_MAX_WIDTH,
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbe3ef",
    position: "relative",
  },

  cardBlocked: {
    opacity: 0.55,
    borderColor: "#cbd5e1",
  },

  cardCompact: {
    maxWidth: PREVIEW_CARD_MAX_WIDTH,
    borderRadius: 14,
  },
  cardDense: { width: PREVIEW_DENSE_CARD_WIDTH, maxWidth: "100%", marginTop: 5, borderRadius: 9 },

  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
  },

  image: {
    width: "100%",
    height: PREVIEW_IMAGE_HEIGHT,
    backgroundColor: "#e5e7eb",
  },

  imageCompact: {
    height: PREVIEW_COMPACT_IMAGE_HEIGHT,
  },
  imageDense: { height: PREVIEW_DENSE_IMAGE_HEIGHT },

  body: {
    flexDirection: "row",
    padding: 12,
    gap: 10,
  },
  bodyDense: { padding: 8, gap: 7 },

  leftAccent: {
    width: 3,
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },

  textBlock: {
    flex: 1,
    minWidth: 0,
  },

  siteName: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#2563eb",
    textTransform: "uppercase",
  },

  siteNameRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    gap: 5,
  },

  domainIconBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dbe3ef",
    overflow: "hidden",
  },

  domainIcon: {
    width: 16,
    height: 16,
  },

  domainIconFallback: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e0ecff",
  },

  title: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    color: "#111827",
  },
  titleDense: { marginTop: 2, fontSize: 13, lineHeight: 17 },

  description: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: "#4b5563",
  },
  descriptionDense: { marginTop: 3, fontSize: 11, lineHeight: 14 },

  fullUrlText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: "#6b7280",
    fontWeight: "700",
  },
  urlDense: { marginTop: 4, fontSize: 10, lineHeight: 13 },

  loadingRow: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  loadingText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "700",
  },

  fallbackCard: {
    minHeight: 76,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  fallbackIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#e0ecff",
    alignItems: "center",
    justifyContent: "center",
  },

  fallbackIconText: {
    color: "#2563eb",
    fontSize: 20,
    fontWeight: "900",
  },
});
