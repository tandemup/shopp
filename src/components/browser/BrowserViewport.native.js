import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { WebView } from "react-native-webview";

const BrowserViewport = forwardRef(function BrowserViewport(
  { url, onUrlChange },
  ref,
) {
  const webViewRef = useRef(null);

  useImperativeHandle(ref, () => ({
    reload() {
      webViewRef.current?.reload?.();
    },
  }));

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: url }}
      originWhitelist={["http://*", "https://*"]}
      javaScriptEnabled
      domStorageEnabled
      allowsBackForwardNavigationGestures
      setSupportMultipleWindows={false}
      onNavigationStateChange={(state) => {
        if (state?.url) onUrlChange?.(state.url);
      }}
      style={{ flex: 1, backgroundColor: "#ffffff" }}
    />
  );
});

export default BrowserViewport;
