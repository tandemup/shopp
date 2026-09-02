import React, { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import { getCachedLinkImageUri } from "@/src/utils/linkImageCache";

export default function CachedLinkImage({ uri, style, resizeMode = "cover", onError }) {
  const [cachedUri, setCachedUri] = useState("");
  const currentBlobUrlRef = useRef("");

  const releaseBlobUrl = (value) => {
    if (
      String(value).startsWith("blob:") &&
      typeof URL !== "undefined" &&
      typeof URL.revokeObjectURL === "function"
    ) {
      URL.revokeObjectURL(value);
    }
  };

  useEffect(() => {
    let active = true;
    releaseBlobUrl(currentBlobUrlRef.current);
    currentBlobUrlRef.current = "";
    setCachedUri("");
    getCachedLinkImageUri(uri).then((value) => {
      if (active) {
        if (String(value).startsWith("blob:")) currentBlobUrlRef.current = value;
        setCachedUri(value);
      } else {
        releaseBlobUrl(value);
      }
    });
    return () => {
      active = false;
      releaseBlobUrl(currentBlobUrlRef.current);
      currentBlobUrlRef.current = "";
    };
  }, [uri]);

  if (!cachedUri) return <View style={style} />;
  return <Image source={{ uri: cachedUri }} style={style} resizeMode={resizeMode} onError={onError} />;
}
