const MAX_SIDE = 1200;
const QUALITY = 0.7;

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Safari < 17 kent imageOrientation niet; val terug op <img>.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Kon de foto niet lezen."));
      img.src = url;
    });
  } finally {
    // De browser heeft de data al; de URL mag weg zodra decode klaar is.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Verkleint naar max 1200px op de langste zijde en hercodeert als JPEG q0.7. */
export async function resizeImage(file: File): Promise<File> {
  const source = await loadBitmap(file);
  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;
  if (!width || !height) throw new Error("Kon de foto niet lezen.");

  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kon de foto niet verwerken.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error("Kon de foto niet verwerken.");

  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}
