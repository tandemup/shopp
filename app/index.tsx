import { useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startApp = async () => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }).start();

      await new Promise((resolve) => setTimeout(resolve, 800));

      router.replace("/(tabs)/shopping");
    };

    startApp();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ alignItems: "center", opacity: fadeAnim }}>
        <Image
          source={require("../assets/images/splash-icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Shop</Text>
        <Text style={styles.subtitle}>
          Tu lista de compras inteligente
        </Text>
      </Animated.View>

      <ActivityIndicator
        size="large"
        color="#2e7d32"
        style={{ marginTop: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  logo: {
    width: 130,
    height: 130,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2e7d32",
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    marginTop: 6,
  },
});
