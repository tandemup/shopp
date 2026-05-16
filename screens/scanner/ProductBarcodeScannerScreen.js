import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useNavigation, useRoute } from "@react-navigation/native";

import BarcodeScannerView from "../../components/features/scanner/BarcodeScannerView";
import { ROUTES } from "../../navigation/ROUTES";

export default function ProductBarcodeScannerScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const isHandlingScanRef = useRef(false);

  const { listId, itemId, barcodeTypes } = route.params || {};

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  function handleDetected(code) {
    if (isHandlingScanRef.current) return;

    isHandlingScanRef.current = true;

    const barcode = String(code || "")
      .replace(/\D/g, "")
      .trim();

    if (!barcode) {
      isHandlingScanRef.current = false;
      return;
    }

    navigation.navigate(ROUTES.SHOPPING_TAB, {
      screen: ROUTES.ITEM_DETAIL,
      params: {
        listId,
        itemId,
        scannedBarcode: barcode,
      },
    });
  }

  function handleClose() {
    navigation.goBack();
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" backgroundColor="#000000" translucent={false} />

      <BarcodeScannerView
        onDetected={handleDetected}
        onClose={handleClose}
        continuous={false}
        barcodeTypes={barcodeTypes}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
  },
});
