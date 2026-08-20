import {
  getProductImages,
  saveProductImageBlobs,
} from "@/src/storage/productImageStorage";

async function uploadBlob(generateUploadUrl, blob) {
  const uploadUrl = await generateUploadUrl({});
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type || "image/jpeg" },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`No se pudo subir la imagen (${response.status}).`);
  }

  const result = await response.json();
  if (!result?.storageId) throw new Error("Convex no devolvió el storageId.");
  return result.storageId;
}

export async function uploadTemporaryProductImages({
  barcode,
  generateUploadUrl,
  saveRemoteImages,
}) {
  const { detail, thumbnail } = await getProductImages(barcode);
  if (!detail?.blob || !thumbnail?.blob) return { uploaded: false };

  const [detailStorageId, thumbnailStorageId] = await Promise.all([
    uploadBlob(generateUploadUrl, detail.blob),
    uploadBlob(generateUploadUrl, thumbnail.blob),
  ]);

  await saveRemoteImages({
    barcode,
    detailStorageId,
    thumbnailStorageId,
    detailMimeType: detail.blob.type || "image/jpeg",
    thumbnailMimeType: thumbnail.blob.type || "image/jpeg",
    detailBytes: detail.blob.size,
    thumbnailBytes: thumbnail.blob.size,
  });
  return { uploaded: true };
}

async function downloadBlob(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar la imagen (${response.status}).`);
  }
  return await response.blob();
}

export async function restoreTemporaryProductImages(barcode, remoteImages) {
  if (!remoteImages?.detailUrl || !remoteImages?.thumbnailUrl) return null;

  const [detailBlob, thumbnailBlob] = await Promise.all([
    downloadBlob(remoteImages.detailUrl),
    downloadBlob(remoteImages.thumbnailUrl),
  ]);

  await saveProductImageBlobs(barcode, {
    detailBlob,
    thumbnailBlob,
    source: "convex-temporary",
  });
  return { detailBlob, thumbnailBlob };
}
