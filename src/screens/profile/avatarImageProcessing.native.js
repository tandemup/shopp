// The current AI package uses browser APIs and is therefore only bundled by
// the .web implementation. Native keeps the cropped PNG until a native
// segmentation module is selected; it must not pretend that a colour-key
// removal is person segmentation.
export async function removeBackgroundAndAddOutline(uri) {
  return uri;
}
