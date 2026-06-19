// screens/scanner/ScannerLibraryTestScreen.web.js

import React from "react";
import { SafeAlert } from "../../components/ui/alert/SafeAlert";
import TestReactBarcodeScannerWeb from "../../components/features/scanner/TestReactBarcodeScanner.web";

export default function ScannerLibraryTestScreen({ navigation }) {
  return (
    <TestReactBarcodeScannerWeb
      onDetected={(code) => {
        console.log("EAN-13 detectado:", code);
        SafeAlert("Código detectado", code);
      }}
      onClose={() => navigation?.goBack?.()}
    />
  );
}
