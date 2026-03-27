import { getAddressFromCoords } from "@/lib/reverse-geocode";

export type SelfieOverlayLocation = {
  latitude: number;
  longitude: number;
  /** If set, skips Nominatim and uses this as the full address string */
  address?: string | null;
};

/**
 * Draws time, date, weekday, and location on the bottom-left of the captured image.
 * Output is PNG for storage upload.
 */
export async function addAttendanceOverlayToImage(
  imageBlob: Blob,
  location: SelfieOverlayLocation
): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("Overlay requires a browser environment");
  }

  const { latitude, longitude, address: presetAddress } = location;

  const address =
    presetAddress && presetAddress.trim()
      ? presetAddress.trim()
      : await getAddressFromCoords(latitude, longitude);

  console.log("ADDRESS:", address);

  const addressStr = (address || `${latitude}, ${longitude}`).trim();

  const bitmap = await createImageBitmap(imageBlob);
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas not supported");
    }

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);

    const now = new Date();
    const manila: Intl.DateTimeFormatOptions = { timeZone: "Asia/Manila" };
    const time = now.toLocaleTimeString([], {
      ...manila,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const date = now.toLocaleDateString([], {
      ...manila,
      month: "short",
      day: "2-digit",
      year: "numeric",
    });

    const startX = 15;
    const baseY = canvas.height - 60;
    const maxWidth = canvas.width - 30;

    // Minimal premium text style.
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.font = "bold 16px Arial";
    ctx.fillText(time, startX, baseY);

    ctx.font = "13px Arial";
    ctx.fillText(date, startX, baseY + 18);

    ctx.font = "12px Arial";
    ctx.fillText(addressStr, startX, baseY + 36, maxWidth);

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(b => resolve(b), "image/png")
    );
    if (!blob) {
      throw new Error("Failed to create overlay image");
    }

    console.log("Overlay image created");
    return blob;
  } finally {
    bitmap.close();
  }
}
