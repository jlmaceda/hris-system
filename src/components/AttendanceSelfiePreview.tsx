import { useState } from "react";
import { ImageModal } from "@/components/ImageModal";

type AttendanceSelfiePreviewProps = {
  url: string | null | undefined;
  width?: number;
};

export function AttendanceSelfiePreview({ url, width = 80 }: AttendanceSelfiePreviewProps) {
  const [open, setOpen] = useState(false);
  const trimmed = url?.trim();
  if (!trimmed) {
    return <span className="text-muted-foreground text-xs">No image</span>;
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex rounded-lg overflow-hidden border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label="Open selfie preview"
      >
        <img
          src={trimmed}
          alt="Attendance selfie"
          width={width}
          className="rounded-lg cursor-zoom-in object-cover align-top"
        />
      </button>
      <ImageModal open={open} imageUrl={trimmed} onClose={() => setOpen(false)} />
    </>
  );
}
