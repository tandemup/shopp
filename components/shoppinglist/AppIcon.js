import React from "react";
import { View, Image } from "react-native";
import Svg, { Path } from "react-native-svg";
import ICONS from "../icons";

export default function AppIcon({ name, size = 22, color = "#374151", style }) {
  const icon = ICONS[name];

  if (!icon) {
    if (__DEV__) {
      console.warn(`[AppIcon] Icon not found: ${name}`);
    }
    return null;
  }

  // 🟢 SVG INLINE (recomendado)
  if (icon.type === "svg") {
    return (
      <View style={style}>
        <Svg
          width={size}
          height={size}
          viewBox={icon.viewBox || "0 0 24 24"}
          fill={icon.fill ? color : "none"}
          stroke={icon.fill ? "none" : color}
          strokeWidth={icon.strokeWidth ?? 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d={icon.path} />
        </Svg>
      </View>
    );
  }

  // 🟡 IMAGE (PNG/JPG)
  if (icon.type === "image") {
    return (
      <Image
        source={icon.source}
        style={[
          {
            width: size,
            height: size,
            tintColor: icon.tintable ? color : undefined,
          },
          style,
        ]}
        resizeMode="contain"
      />
    );
  }

  return null;
}
