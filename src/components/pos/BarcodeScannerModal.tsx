import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import {
  AlertCircle,
  Barcode,
  Camera,
  CheckCircle2,
  Flashlight,
  Maximize2,
  RefreshCw,
  Scan,
  Sparkles,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, type Product } from "@/lib/store";
import { playScannerBeep } from "@/lib/scannerAudio";
import { cn } from "@/lib/utils";

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onBarcodeScanned: (barcode: string) => boolean | void;
  cartCount: number;
  cartTotal: number;
}

function normalizeCode(val: string | number | undefined | null): string {
  return String(val ?? "")
    .trim()
    .replace(/[\r\n\t\s\-_]/g, "")
    .toLowerCase();
}

export function BarcodeScannerModal({
  open,
  onClose,
  products,
  onBarcodeScanned,
  cartCount,
  cartTotal,
}: BarcodeScannerModalProps) {
  const [manualCode, setManualCode] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [lastScanned, setLastScanned] = useState<{ code: string; name: string; price: number; time: string } | null>(null);
  const [scanCooldown, setScanCooldown] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const cooldownRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync ref with state for callback closures
  cooldownRef.current = scanCooldown;

  // Process barcode callback
  const processBarcode = (code: string) => {
    const trimmed = code.trim().replace(/[\r\n\t]/g, "");
    if (!trimmed || cooldownRef.current) return;

    const norm = normalizeCode(trimmed);

    // Find product matching barcode or SKU or ID
    const matched = products.find((p) => {
      return (
        normalizeCode(p.barcode) === norm ||
        normalizeCode(p.sku) === norm ||
        normalizeCode(p.id) === norm
      );
    });

    if (matched) {
      playScannerBeep("success");
      setLastScanned({
        code: trimmed,
        name: matched.name,
        price: matched.price,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      });

      onBarcodeScanned(trimmed);

      // Cooldown to avoid rapid duplicate scans of the same item
      setScanCooldown(true);
      setTimeout(() => setScanCooldown(false), 1200);

      if (!continuousMode) {
        onClose();
      }
    } else {
      playScannerBeep("error");
      setLastScanned({
        code: trimmed,
        name: "Unknown Barcode (Not in store)",
        price: 0,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      });
      onBarcodeScanned(trimmed);
    }

    setManualCode("");
    inputRef.current?.focus();
  };

  // Start real-time ZXing barcode scanner
  const startScanner = async () => {
    setCameraError(null);
    try {
      if (!videoRef.current) return;

      // Stop existing if running
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const hints = new Map();
      // Try harder for lower contrast or angled camera barcodes
      hints.set(3, true); // TRY_HARDER

      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result, error) => {
          if (result && !cooldownRef.current) {
            const text = result.getText();
            if (text) {
              processBarcode(text);
            }
          }
        }
      );

      controlsRef.current = controls;
      setCameraActive(true);
    } catch (err: unknown) {
      console.warn("ZXing Camera scanner failed:", err);
      const msg = err instanceof Error ? err.message : "Camera access denied or device not found";
      setCameraError(msg);
      setCameraActive(false);
    }
  };

  const stopScanner = () => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (e) {
        console.warn("Error stopping scanner controls", e);
      }
      controlsRef.current = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  };

  // Handle open/close of dialog
  useEffect(() => {
    if (!open) {
      stopScanner();
      return;
    }

    // Auto-focus manual input
    setTimeout(() => inputRef.current?.focus(), 120);

    // Start scanner automatically when modal is open
    startScanner();

    return () => {
      stopScanner();
    };
  }, [open]);

  const toggleTorch = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (track && "applyConstraints" in track) {
      try {
        const nextState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as MediaTrackConstraintSet],
        });
        setTorchOn(nextState);
      } catch (e) {
        console.warn("Torch not supported on this camera", e);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col rounded-3xl p-0 overflow-hidden border border-slate-200 bg-white shadow-2xl [&>button:last-child]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3.5 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30">
              <Scan className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                POS Barcode Scanner
              </DialogTitle>
              <p className="text-xs text-slate-400">
                Real-time optical scanner for Code 128, EAN, and UPC product barcodes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors shadow-xs">
              <input
                type="checkbox"
                checked={continuousMode}
                onChange={(e) => setContinuousMode(e.target.checked)}
                className="size-3.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Crowd Mode</span>
            </label>

            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-xl bg-slate-200/80 hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors border border-slate-300/60 shadow-xs"
              title="Close Scanner (Esc)"
              aria-label="Close Scanner"
            >
              <X className="size-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Viewport: Real-time Camera Scanner View */}
        <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-h-0">
          {/* Camera Frame */}
          <div className="relative h-44 sm:h-48 w-full overflow-hidden rounded-2xl bg-slate-950 flex flex-col items-center justify-center text-white shadow-inner shrink-0">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn(
                "absolute inset-0 size-full object-cover transition-opacity duration-300",
                cameraActive ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            />

            {/* Target Reticle & Laser Beam Overlay */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div
                className={cn(
                  "relative size-36 sm:size-40 rounded-2xl border-2 transition-all duration-300",
                  scanCooldown
                    ? "border-emerald-400 bg-emerald-500/15 shadow-[0_0_30px_rgba(52,211,153,0.4)]"
                    : "border-blue-400/90 bg-transparent"
                )}
              >
                {/* 4 Corner Markers */}
                <div className="absolute -top-1 -left-1 size-4 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 size-4 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 size-4 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 size-4 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />

                {/* Animated Red Laser Scan Line */}
                <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-bounce" />

                <div className="absolute bottom-1.5 inset-x-0 text-center">
                  <span className="rounded-md bg-black/70 backdrop-blur-sm px-2 py-0.5 text-[9px] font-mono font-medium text-slate-200">
                    {scanCooldown ? "✓ Scanned!" : "Point camera at barcode"}
                  </span>
                </div>
              </div>
            </div>

            {/* Camera Controls Bar */}
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              <button
                type="button"
                onClick={toggleTorch}
                title="Toggle Flashlight / Torch"
                className={cn(
                  "grid size-9 place-items-center rounded-xl backdrop-blur-md transition-colors",
                  torchOn ? "bg-amber-400 text-slate-900" : "bg-black/50 text-white hover:bg-black/70"
                )}
              >
                <Flashlight className="size-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  stopScanner();
                  startScanner();
                }}
                title="Restart Camera"
                className="grid size-9 place-items-center rounded-xl bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition-colors"
              >
                <RefreshCw className="size-4" />
              </button>
            </div>

            {/* Camera fallback if not active */}
            {!cameraActive && (
              <div className="z-10 p-6 text-center space-y-3">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/10 text-slate-300">
                  <Camera className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Camera Scanner Idle</p>
                  <p className="mt-1 text-xs text-slate-400 max-w-xs mx-auto">
                    {cameraError || "Click below to activate camera, or type / scan using your USB barcode gun."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startScanner}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md transition-colors"
                >
                  Activate Camera Stream
                </button>
              </div>
            )}
          </div>

          {/* Quick Hardware Scanner Gun & Manual Input Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
              <span>Hardware Scanner Gun / Keyboard</span>
              <span className="flex items-center gap-1 text-emerald-600 font-semibold normal-case">
                <Zap className="size-3.5 fill-emerald-500 text-emerald-500" />
                Gun Ready (Plug & Zap)
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                processBarcode(manualCode);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Barcode className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Scan barcode gun or enter barcode number..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                />
              </div>
              <button
                type="submit"
                className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 shadow-sm transition-colors shrink-0"
              >
                Add to Bill
              </button>
            </form>
          </div>

          {/* Last Scanned Status Alert */}
          {lastScanned && (
            <div
              className={cn(
                "flex items-center justify-between rounded-xl border p-3.5 text-xs transition-all",
                lastScanned.price > 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              )}
            >
              <div className="flex items-center gap-2.5">
                {lastScanned.price > 0 ? (
                  <CheckCircle2 className="size-4.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="size-4.5 text-amber-600 shrink-0" />
                )}
                <div>
                  <p className="font-bold">
                    {lastScanned.name}{" "}
                    {lastScanned.price > 0 && <span>· {formatCurrency(lastScanned.price)}</span>}
                  </p>
                  <p className="font-mono text-[11px] opacity-80">
                    Code: {lastScanned.code} · Scanned at {lastScanned.time}
                  </p>
                </div>
              </div>
              <span className="font-semibold px-2 py-0.5 rounded-full bg-white/70 border border-current text-[10px]">
                {lastScanned.price > 0 ? "Added to Cart" : "Not Found"}
              </span>
            </div>
          )}

          {/* Quick-Scan Product Chips: Useful for rapid testing or damaged physical labels */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                Quick Barcode Test Samples
              </span>
              <span>Tap any item to simulate scan</span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => processBarcode(p.barcode || "")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <Barcode className="size-3 text-slate-400" />
                  <span className="truncate max-w-[120px] font-semibold">{p.name}</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {p.barcode ? p.barcode.slice(-4) : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer: Live Cart Count + Finish/Close Buttons */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/90 px-6 py-3.5 shrink-0">
          <div>
            <p className="text-xs text-slate-400">Current Bill Progress</p>
            <p className="text-sm font-bold text-slate-900">
              {cartCount} items · <span className="text-blue-600">{formatCurrency(cartTotal)}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-xs transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition-colors"
            >
              Done & View Bill
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
