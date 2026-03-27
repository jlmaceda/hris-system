import { useEffect, useRef, useState } from "react";

type ImageModalProps = {
  open: boolean;
  imageUrl: string | null;
  onClose: () => void;
  alt?: string;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.2;

function getTouchDistance(touches: TouchList): number | null {
  if (touches.length < 2) return null;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function clampZoom(value: number): number {
  return Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM);
}

export function ImageModal({ open, imageUrl, onClose, alt = "Attendance selfie" }: ImageModalProps) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(MIN_ZOOM);

  useEffect(() => {
    if (!open) return;
    setZoom(MIN_ZOOM);
  }, [open, imageUrl]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 p-3 sm:p-4 flex items-center justify-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full sm:h-[92vh] max-w-5xl rounded-xl bg-white dark:bg-gray-800 shadow-xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Image preview"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm"
            onClick={() => setZoom(currentZoom => clampZoom(currentZoom + ZOOM_STEP))}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm"
            onClick={() => setZoom(currentZoom => clampZoom(currentZoom - ZOOM_STEP))}
            aria-label="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm"
            onClick={onClose}
            aria-label="Close image preview"
          >
            X
          </button>
        </div>

        <div
          className="flex-1 overflow-auto p-3 sm:p-5 flex items-center justify-center touch-none"
          onWheel={event => {
            event.preventDefault();
            const delta = event.deltaY * -0.001;
            setZoom(currentZoom => clampZoom(currentZoom + delta));
          }}
          onTouchStart={event => {
            const distance = getTouchDistance(event.touches);
            if (distance == null) return;
            pinchStartDistanceRef.current = distance;
            pinchStartZoomRef.current = zoom;
          }}
          onTouchMove={event => {
            const startDistance = pinchStartDistanceRef.current;
            const currentDistance = getTouchDistance(event.touches);
            if (startDistance == null || currentDistance == null || startDistance === 0) return;
            const scale = currentDistance / startDistance;
            setZoom(clampZoom(pinchStartZoomRef.current * scale));
          }}
          onTouchEnd={() => {
            if (pinchStartDistanceRef.current == null) return;
            pinchStartDistanceRef.current = null;
            pinchStartZoomRef.current = zoom;
          }}
        >
          <img
            src={imageUrl}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded-lg transition-transform duration-200 ease-out"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          />
        </div>
      </div>
    </div>
  );
}
