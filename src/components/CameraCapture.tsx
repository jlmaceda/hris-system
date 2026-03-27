import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type CapturedImage = {
  blob: Blob;
  /** Base64 data URL (`data:image/png;base64,...`) */
  dataUrl: string;
};

type CameraCaptureProps = {
  /** When false, camera stream is stopped and capture is cleared */
  active: boolean;
  /** Disables capture / retake (e.g. while uploading) */
  disabled?: boolean;
  className?: string;
  onCapture?: (image: CapturedImage) => void;
};

export function CameraCapture({ active, className, disabled = false, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoMeta, setVideoMeta] = useState<{ width: number; height: number } | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [captured, setCaptured] = useState<CapturedImage | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!active) {
      setCaptured(null);
      setStreamError(null);
      setVideoMeta(null);
      setIsInitializing(false);
      return;
    }

    let stream: MediaStream | null = null;

    async function start() {
      setIsInitializing(true);
      setStreamError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not supported on this device/browser.");
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 4 / 3 },
          },
          audio: false,
        });
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          await el.play().catch(() => {});
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not access camera";
        setStreamError(message);
      } finally {
        setIsInitializing(false);
      }
    }

    void start();

    return () => {
      stream?.getTracks().forEach(t => t.stop());
      const el = videoRef.current;
      if (el) el.srcObject = null;
    };
  }, [active, retryNonce]);

  const takeSnapshot = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/png");

    canvas.toBlob(
      blob => {
        if (!blob) return;
        const image: CapturedImage = { blob, dataUrl };
        setCaptured(image);
        onCapture?.(image);
      },
      "image/png"
    );
  }, [onCapture]);

  const retake = useCallback(() => {
    setCaptured(null);
  }, []);

  if (!active) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <canvas ref={canvasRef} className="hidden" aria-hidden />

      {streamError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive space-y-2">
          <p className="font-medium">Camera unavailable</p>
          <p className="text-destructive/90">{streamError}</p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setRetryNonce(v => v + 1)}
            disabled={disabled}
          >
            Try again
          </Button>
        </div>
      ) : captured ? (
        <div className="space-y-3">
          <div
            className="relative w-full overflow-hidden rounded-lg bg-muted"
            style={{ aspectRatio: videoMeta ? `${videoMeta.width}/${videoMeta.height}` : undefined }}
          >
            <img src={captured.dataUrl} alt="Captured preview" className="h-full w-full object-cover" />
          </div>
          <p className="text-xs text-muted-foreground text-center">Image kept in memory until you close or retake.</p>
          <Button type="button" variant="outline" className="w-full" onClick={retake} disabled={disabled}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Retake
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className="relative w-full overflow-hidden rounded-lg bg-black"
            style={{ aspectRatio: videoMeta ? `${videoMeta.width}/${videoMeta.height}` : "4/3" }}
          >
            <video
              ref={videoRef}
              className="h-full w-full object-cover [transform:scaleX(-1)]"
              playsInline
              muted
              autoPlay
              onLoadedMetadata={() => {
                const v = videoRef.current;
                if (!v) return;
                if (!v.videoWidth || !v.videoHeight) return;
                setVideoMeta({ width: v.videoWidth, height: v.videoHeight });
              }}
            />
            {isInitializing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
                <p className="text-xs text-white/90">Initializing camera…</p>
              </div>
            )}
          </div>
          <Button type="button" className="w-full" onClick={takeSnapshot} disabled={disabled || isInitializing}>
            <Camera className="mr-2 h-4 w-4" />
            Capture
          </Button>
        </div>
      )}
    </div>
  );
}
