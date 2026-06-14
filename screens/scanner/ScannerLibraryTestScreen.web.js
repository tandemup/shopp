// screens/scanner/ScannerLibraryTestScreen.web.js

import React from "react";
import { Alert } from "react-native";
import TestReactBarcodeScannerWeb from "../../components/features/scanner/TestReactBarcodeScanner.web";

export default function ScannerLibraryTestScreen({ navigation }) {
  return (
    <TestReactBarcodeScannerWeb
      onDetected={(code) => {
        console.log("EAN-13 detectado:", code);
        Alert.alert("Código detectado", code);
      }}
      onClose={() => navigation?.goBack?.()}
    />
  );
}
