import React from "react";

export default function BrowserViewport({ url, reloadKey = 0 }) {
  return (
    <iframe
      key={`${url}-${reloadKey}`}
      title="Shopp Browser"
      src={url}
      sandbox="allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
      referrerPolicy="strict-origin-when-cross-origin"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        minHeight: 0,
        border: 0,
        backgroundColor: "#ffffff",
      }}
    />
  );
}
