import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  CommonActions,
  useNavigation,
  useRoute,
} from "@react-navigation/native";

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

  function normalizeBarcode(code) {
    return String(code || "")
      .replace(/\D/g, "")
      .trim();
  }

  function returnToItemDetail(barcode) {
    const parentNavigation = navigation.getParent();

    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: ROUTES.SCANNER_HOME,
          },
        ],
      }),
    );

    parentNavigation?.navigate(ROUTES.SHOPPING_TAB, {
      screen: ROUTES.ITEM_DETAIL,
      params: {
        listId,
        itemId,
        scannedBarcode: barcode,
      },
    });
  }

  function handleDetected(code) {
    if (isHandlingScanRef.current) return;

    isHandlingScanRef.current = true;

    const barcode = normalizeBarcode(code);

    if (!barcode) {
      isHandlingScanRef.current = false;
      return;
    }

    returnToItemDetail(barcode);
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
