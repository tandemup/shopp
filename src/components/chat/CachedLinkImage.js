import React, { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { getCachedLinkImageUri } from "@/src/utils/linkImageCache";

export default function CachedLinkImage({ uri, style, resizeMode = "cover", onError }) {
  const [cachedUri, setCachedUri] = useState("");
  useEffect(() => {
    let active = true;
    setCachedUri("");
    getCachedLinkImageUri(uri).then((value) => active && setCachedUri(value));
    return () => { active = false; };
  }, [uri]);

  if (!cachedUri) return <View style={style} />;
  return <Image source={{ uri: cachedUri }} style={style} resizeMode={resizeMode} onError={onError} />;
}
