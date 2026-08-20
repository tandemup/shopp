function loadImage(uri) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = uri;
  });
}

export async function removeBackgroundAndAddOutline(uri, outlineWidth = 3) {
  // Deliberately contains no AI import. @imgly/background-removal uses
  // dynamic WebAssembly imports that Expo Metro cannot bundle reliably.
  // The image has already been cropped and converted to PNG by the editor.
  const image = await loadImage(uri);
  const size = Math.min(image.naturalWidth || image.width, 128);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, size, size);

  // Draw an outline only around transparent pixels adjacent to opaque pixels.
  // This is useful when the input already contains transparency; it does not
  // claim to remove a photographic background.
  const subject = context.getImageData(0, 0, size, size);
  const outline = Math.max(0, Math.min(10, Math.round(outlineWidth)));
  if (outline > 0) {
    const copy = new Uint8ClampedArray(subject.data);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const index = (y * size + x) * 4;
        if (copy[index + 3] !== 0) continue;
        let found = false;
        for (let oy = -outline; oy <= outline && !found; oy += 1) {
          for (let ox = -outline; ox <= outline; ox += 1) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
            if (copy[(ny * size + nx) * 4 + 3] > 0) {
              found = true;
              break;
            }
          }
        }
        if (found) {
          subject.data[index] = 255;
          subject.data[index + 1] = 255;
          subject.data[index + 2] = 255;
          subject.data[index + 3] = 255;
        }
      }
    }
    context.putImageData(subject, 0, 0);
  }
  return canvas.toDataURL("image/png");
}
