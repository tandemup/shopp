import React, { useEffect, useRef } from "react";
import { Animated, Image, StatusBar, StyleSheet, View } from "react-native";

import splashImage from "@/assets/images/splash.png";

const DISPLAY_TIME_MS = 1800;

export default function SplashScreen({ onFinish }) {
  const opacity = useRef(new Animated.Value(0)).current;

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
        <Image source={splashImage} style={styles.image} resizeMode="cover" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  imageContainer: {
    flex: 1,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
