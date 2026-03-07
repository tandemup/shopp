export async function loadApp() {
  console.log("Loading app...");

  // simulación de carga
  await new Promise((resolve) => setTimeout(resolve, 1200));

  console.log("App ready");
}
