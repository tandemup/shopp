const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// @imgly/background-removal contains an optional dynamic import of
// "onnxruntime-web/webgpu". Expo Web does not need WebGPU here because the
// processor explicitly uses the CPU backend. Redirect the optional import to
// the regular browser build so Metro can bundle the application.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Expo Web does not consistently resolve the `@/…` aliases declared in
  // tsconfig/jsconfig. Resolve them explicitly from the project root so the
  // same imports work in Metro, including imports added by the scanned
  // product model.
  if (moduleName.startsWith("@/")) {
    moduleName = path.resolve(__dirname, moduleName.slice(2));
  }

  if (moduleName === "onnxruntime-web/webgpu") {
    moduleName = "onnxruntime-web";
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

// @imgly/background-removal imports ONNX Runtime's browser .mjs build.
// Metro does not include .mjs in Expo projects by default.
config.resolver.sourceExts = [
  ...new Set([...config.resolver.sourceExts, "mjs"]),
];

// Let the package resolve its browser entry point instead of forcing Metro
// through conditional package exports intended for other bundlers.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
