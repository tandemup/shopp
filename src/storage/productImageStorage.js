import { Platform } from "react-native";
import { storage } from "./storage";

const PRODUCT_IMAGE_PREFIX = "@shopping/product-images/";

function normalizeProductId(value) {
  return String(value || "").trim();
}

function imageKey(productId, variant) {
  const normalized = normalizeProductId(productId);
  if (!normalized) {
    throw new Error(
      "No hay un identificador de producto para guardar la imagen.",
    );
  }
  return `${PRODUCT_IMAGE_PREFIX}${normalized}/${variant}`;
}

export function getProductImageKeys(productId) {
  return {
    thumbnail: imageKey(productId, "thumbnail"),
    detail: imageKey(productId, "detail"),
  };
}

export async function saveProductImageBlobs(
  productId,
  { detailBlob, thumbnailBlob, source = "gallery" } = {},
) {
  if (Platform.OS !== "web") {
    throw new Error(
      "El almacenamiento Blob de imágenes está habilitado en la PWA web.",
    );
  }
  if (!(detailBlob instanceof Blob) || !(thumbnailBlob instanceof Blob)) {
    throw new Error("Las imágenes deben ser objetos Blob válidos.");
  }

  const keys = getProductImageKeys(productId);
  const commonMetadata = {
    source,
    savedAt: Date.now(),
  };

  await Promise.all([
    storage.setFile(keys.detail, detailBlob, {
      ...commonMetadata,
      variant: "detail",
      fileName: "detail.jpeg",
      mimeType: detailBlob.type || "image/jpeg",
      size: detailBlob.size,
    }),
    storage.setFile(keys.thumbnail, thumbnailBlob, {
      ...commonMetadata,
      variant: "thumbnail",
      fileName: "thumbnail.jpeg",
      mimeType: thumbnailBlob.type || "image/jpeg",
      size: thumbnailBlob.size,
    }),
  ]);

  return keys;
}

export async function getProductImage(productId, variant = "detail") {
  const keys = getProductImageKeys(productId);
  return storage.getFile(keys[variant] || keys.detail);
}

export async function getProductImages(productId) {
  const keys = getProductImageKeys(productId);
  const [detail, thumbnail] = await Promise.all([
    storage.getFile(keys.detail),
    storage.getFile(keys.thumbnail),
  ]);
  return { detail, thumbnail, keys };
}

export async function removeProductImages(productId) {
  const keys = getProductImageKeys(productId);
  await Promise.all([
    storage.removeFile(keys.detail),
    storage.removeFile(keys.thumbnail),
  ]);
}
