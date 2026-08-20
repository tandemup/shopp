import { registerRootComponent } from "expo";
import "./web.css";
import App from "./App";

const SHOPP_CHROME_COLOR = "#FFFBF3";

function upsertMeta(name, content) {
  if (typeof document === "undefined") return;

  let meta = document.head.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

// Configure the iPhone/iPad web-app chrome before React mounts. This keeps
// the status-bar area visually continuous with Shopp's top navigation bar.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    document.documentElement.classList.add("shopp-standalone");
  }

  // Safari 15+ and installed web apps can use theme-color for surrounding UI.
  upsertMeta("theme-color", SHOPP_CHROME_COLOR);

  // Keep the standard dark status icons. We intentionally do not use
  // black-translucent because it changes the status-bar presentation and can
  // reduce icon contrast on this light Shopp header.
  upsertMeta("apple-mobile-web-app-capable", "yes");
  upsertMeta("apple-mobile-web-app-status-bar-style", "default");
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Expo Web generates the application shell, while this worker makes the
// deployed site installable and keeps the shell available after first load.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("No se pudo registrar el service worker de Shopp", error);
    });
  });
}
