import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

//import splashImage from "@/assets/images/splash.png";
import splashImage from "@/assets/images/splash-icon.png";

const DISPLAY_TIME_MS = 2800;

export default function SplashScreen({ onFinish }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const { width, height } = useWindowDimensions();
  const imageSize = Math.min(width * 0.92, height * 0.48, 420);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(onFinish, DISPLAY_TIME_MS);
    return () => clearTimeout(timer);
  }, [onFinish, opacity]);

  return (
    <View style={styles.screen} accessibilityLabel="Bienvenido a Shopp">
      <StatusBar hidden animated />
      <Animated.View style={[styles.imageContainer, { opacity }]}>
        <View style={styles.brand}>
          <Image
            source={splashImage}
            style={{ width: imageSize, height: imageSize }}
            resizeMode="contain"
          />
          <Text style={[styles.name, { marginTop: -imageSize * 0.16 }]}>
            Shopp
          </Text>
          <Text style={styles.subtitle}>Tu lista de la compra inteligente</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFBF3",
  },
  imageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  name: {
    color: "#0476E0",
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 0.4,
    textShadowColor: "rgba(4, 118, 224, 0.18)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 7,
    color: "#475467",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.15,
    lineHeight: 23,
    textAlign: "center",
  },
});
