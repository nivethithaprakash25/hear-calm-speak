import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { Camera } from "lucide-react";

export interface DetectionStats {
  currentCount: number;
  totalIn: number;
  totalOut: number;
  peakCount: number;
  detections: cocoSsd.DetectedObject[];
  childCount: number;
  adultCount: number;
}

interface Props {
  onStatsUpdate: (stats: DetectionStats) => void;
  onAlert?: (message: string, severity: "info" | "warning" | "danger") => void;
  isRunning: boolean;
}

export interface WebcamHandle {
  startCamera: () => void;
  stopCamera: () => void;
}

const WebcamDetector = forwardRef<WebcamHandle, Props>(
  ({ onStatsUpdate, onAlert, isRunning }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
    const statsRef = useRef<DetectionStats>({
      currentCount: 0,
      totalIn: 0,
      totalOut: 0,
      peakCount: 0,
      detections: [],
      childCount: 0,
      adultCount: 0,
    });
    const prevCountRef = useRef(0);
    const personHistoryRef = useRef<Map<string, { positions: number[][]; firstSeen: number }>>(new Map());
    const prevBboxRef = useRef<number[][]>([]);

    const [modelLoaded, setModelLoaded] = useState(false);
    const [modelLoading, setModelLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [needsUserGesture, setNeedsUserGesture] = useState(false);
    const animFrameRef = useRef<number>(0);
    const streamRef = useRef<MediaStream | null>(null);
    const detectingRef = useRef(false);

    const startCamera = useCallback(async () => {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise<void>((resolve, reject) => {
            const v = videoRef.current!;
            v.onloadedmetadata = () => {
              v.play().then(resolve).catch(reject);
            };
            setTimeout(resolve, 3000);
          });
          setCameraActive(true);
          setNeedsUserGesture(false);
        }
      } catch (err: any) {
        console.error("Camera error:", err);
        if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
          setNeedsUserGesture(true);
          setError("Camera permission needed. Click the button below to allow access.");
        } else {
          setError(`Camera error: ${err?.message || "Unknown error"}. Try opening in a new tab.`);
        }
      }
    }, []);

    const stopCamera = useCallback(() => {
      detectingRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      setCameraActive(false);
    }, []);

    useImperativeHandle(ref, () => ({ startCamera, stopCamera }), [startCamera, stopCamera]);

    // Load model once
    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          setModelLoading(true);
          await tf.ready();
          const model = await cocoSsd.load({ base: "lite_mobilenet_v2" });
          if (!cancelled) {
            modelRef.current = model;
            setModelLoaded(true);
            setModelLoading(false);
          }
        } catch (err) {
          if (!cancelled) {
            setError("Failed to load AI model. Try refreshing.");
            setModelLoading(false);
          }
        }
      })();
      return () => { cancelled = true; };
    }, []);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
      };
    }, []);

    // Start/stop camera based on isRunning
    useEffect(() => {
      if (isRunning && !cameraActive && modelLoaded) {
        startCamera();
      } else if (!isRunning && cameraActive) {
        stopCamera();
      }
    }, [isRunning, modelLoaded, cameraActive, startCamera, stopCamera]);

    const detect = useCallback(async () => {
      if (!modelRef.current || !videoRef.current || !canvasRef.current) {
        if (detectingRef.current) animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState < 2 || video.paused || video.videoWidth === 0) {
        if (detectingRef.current) animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      let predictions: cocoSsd.DetectedObject[] = [];
      try {
        predictions = await modelRef.current.detect(video);
      } catch {
        if (detectingRef.current) animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      // ── Shadow & noise rejection helper ──────────────────────────────
      // Shadows are typically wide & flat (low height-to-width ratio) and
      // very large relative to the frame. Real people (incl. children) are
      // taller than they are wide and occupy a reasonable area.
      const frameArea = canvas.width * canvas.height;
      const isRealPerson = (bbox: number[]): boolean => {
        const [, , w, h] = bbox;
        const aspectRatio = h / (w || 1);          // real people: > 0.7
        const areaRatio = (w * h) / (frameArea || 1); // shadow can be > 40% of frame
        const minDim = Math.min(w, h);

        // Reject if too flat (shadow) or tiny (noise) or unrealistically huge
        if (aspectRatio < 0.55) return false;       // too wide → shadow / lying object
        if (areaRatio > 0.70) return false;         // > 70% of frame → almost certainly shadow
        if (minDim < 25) return false;              // too small → pixel noise
        return true;
      };

      // Children score a bit lower in COCO-SSD — threshold 0.40 + shape filter
      // Adults stay at 0.50 + shape filter. Both go through isRealPerson.
      const rawPeople = predictions.filter(
        (p) => p.class === "person" && p.score > 0.40
      );

      // Classify each detection
      type PersonDetection = { obj: (typeof rawPeople)[0]; isChild: boolean };
      const classified: PersonDetection[] = rawPeople
        .filter((p) => isRealPerson(p.bbox))
        .map((p) => {
          const [, , w, h] = p.bbox;
          // Children tend to have smaller bboxes and lower confidence
          const areaRatio = (w * h) / (frameArea || 1);
          const isChild =
            p.score < 0.60 &&          // lower confidence is common for children
            areaRatio < 0.12 &&        // smaller frame footprint
            h / (w || 1) > 0.85;       // upright posture preserved
          // Adults need stricter confidence (>= 0.50)
          if (!isChild && p.score < 0.50) return null;
          return { obj: p, isChild };
        })
        .filter(Boolean) as PersonDetection[];

      const people = classified.map((c) => c.obj);

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const now = Date.now();
      const currentBboxes = people.map((p) => [...p.bbox]);
      const prevBboxes = prevBboxRef.current;
      const history = personHistoryRef.current;
      const matched = new Set<number>();

      currentBboxes.forEach((bbox, ci) => {
        const [cx, cy] = [bbox[0] + bbox[2] / 2, bbox[1] + bbox[3] / 2];
        let bestDist = Infinity;
        let bestKey = "";

        prevBboxes.forEach((pbox, pi) => {
          if (matched.has(pi)) return;
          const [px, py] = [pbox[0] + pbox[2] / 2, pbox[1] + pbox[3] / 2];
          const dist = Math.hypot(cx - px, cy - py);
          if (dist < bestDist && dist < 150) {
            bestDist = dist;
            bestKey = `person_${pi}`;
          }
        });

        const key = bestKey || `person_new_${now}_${ci}`;
        if (!history.has(key)) {
          history.set(key, { positions: [], firstSeen: now });
        }
        const entry = history.get(key)!;
        entry.positions.push([cx, cy, bbox[2], bbox[3]]);
        if (entry.positions.length > 30) entry.positions.shift();

        if (entry.positions.length > 5) {
          const recent = entry.positions.slice(-5);
          const heightRatios = recent.map((p) => p[3] / (p[2] || 1));
          if (heightRatios[0] > 1.3 && heightRatios[heightRatios.length - 1] < 0.9) {
            onAlert?.("FALL DETECTED — Person may have fallen down!", "danger");
          }
        }
      });

      if (people.length >= 2) {
        for (let i = 0; i < people.length; i++) {
          for (let j = i + 1; j < people.length; j++) {
            const [ax, ay, aw] = people[i].bbox;
            const [bx, by, bw] = people[j].bbox;
            const dist = Math.hypot((ax + aw / 2) - (bx + bw / 2), (ay + people[i].bbox[3] / 2) - (by + people[j].bbox[3] / 2));
            if (dist < (aw + bw) / 2 * 0.5) {
              onAlert?.("PHYSICAL ALTERCATION — Possible fight detected!", "danger");
            }
          }
        }
      }

      if (people.length > prevCountRef.current + 3) {
        onAlert?.("SUDDEN RUSH — Rapid crowd increase detected!", "warning");
      }

      prevBboxRef.current = currentBboxes;

      for (const [key, val] of history.entries()) {
        if (now - val.firstSeen > 60000 && val.positions.length < 2) history.delete(key);
      }

      // ── Draw detection boxes (adults = cyan, children = yellow) ──────
      classified.forEach((det, i) => {
        const { obj: person, isChild } = det;
        const [x, y, w, h] = person.bbox;
        const confidence = Math.round(person.score * 100);

        const mainColor = isChild ? "hsl(48, 95%, 58%)" : "hsl(185, 80%, 50%)";
        const brightColor = isChild ? "hsl(48, 95%, 72%)" : "hsl(185, 80%, 65%)";
        const labelBg = isChild ? "hsla(48, 95%, 58%, 0.90)" : "hsla(185, 80%, 50%, 0.85)";
        const typeTag = isChild ? "CHILD" : "PERSON";

        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        // Corner brackets
        const cl = 12;
        ctx.strokeStyle = brightColor;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y + cl); ctx.lineTo(x, y); ctx.lineTo(x + cl, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + w - cl, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cl); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y + h - cl); ctx.lineTo(x, y + h); ctx.lineTo(x + cl, y + h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + w - cl, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cl); ctx.stroke();

        const label = `${typeTag}-${i + 1} ${confidence}%`;
        ctx.font = "12px JetBrains Mono, monospace";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = labelBg;
        ctx.fillRect(x, y - 20, tw + 8, 18);
        ctx.fillStyle = "hsl(220, 20%, 7%)";
        ctx.fillText(label, x + 4, y - 6);
      });

      const animals = predictions.filter((p) => ["dog", "cat", "bird", "horse"].includes(p.class) && p.score > 0.45);
      animals.forEach((animal) => {
        const [x, y, w, h] = animal.bbox;
        ctx.strokeStyle = "hsl(40, 90%, 55%)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        const label = `Animal: ${animal.class}`;
        ctx.font = "12px JetBrains Mono, monospace";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "hsla(40, 90%, 55%, 0.85)";
        ctx.fillRect(x, y - 20, tw + 8, 18);
        ctx.fillStyle = "hsl(220, 20%, 7%)";
        ctx.fillText(label, x + 4, y - 6);
        onAlert?.(`Animal detected: ${animal.class}`, "warning");
      });

      const currentCount = people.length;
      const childCount = classified.filter((c) => c.isChild).length;
      const adultCount = currentCount - childCount;
      const stats = statsRef.current;
      if (currentCount > prevCountRef.current) stats.totalIn += currentCount - prevCountRef.current;
      else if (currentCount < prevCountRef.current && prevCountRef.current > 0) stats.totalOut += prevCountRef.current - currentCount;
      stats.currentCount = currentCount;
      stats.childCount = childCount;
      stats.adultCount = adultCount;
      if (currentCount > stats.peakCount) stats.peakCount = currentCount;
      stats.detections = people;
      prevCountRef.current = currentCount;
      onStatsUpdate({ ...stats });

      if (currentCount > 8) onAlert?.(`Overcrowding alert! ${currentCount} people detected!`, "danger");

      if (detectingRef.current) animFrameRef.current = requestAnimationFrame(detect);
    }, [onStatsUpdate, onAlert]);

    // Start detection loop when camera is active
    useEffect(() => {
      if (modelLoaded && cameraActive && isRunning) {
        detectingRef.current = true;
        animFrameRef.current = requestAnimationFrame(detect);
      } else {
        detectingRef.current = false;
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = 0;
        }
      }
      return () => {
        detectingRef.current = false;
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    }, [modelLoaded, cameraActive, detect, isRunning]);

    const handleRetryCamera = () => {
      setError(null);
      setNeedsUserGesture(false);
      startCamera();
    };

    const showVideo = cameraActive && isRunning && !error;

    return (
      <div className="relative w-full overflow-hidden rounded-lg border border-border bg-muted">
        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between bg-background/80 backdrop-blur-sm px-3 py-1.5 border-b border-border">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${showVideo ? "bg-success pulse-dot" : "bg-accent"}`} />
            <span className="text-xs font-mono text-muted-foreground">
              {modelLoading ? "Loading AI Model..." : showVideo ? "● LIVE" : "STOPPED"}
            </span>
          </div>
          <span className="text-xs font-mono text-primary">CAM-01 • Main Entry</span>
        </div>

        {/* Placeholder when not showing video */}
        {!showVideo && (
          <div className="flex flex-col items-center justify-center h-80 gap-4 pt-8">
            {error ? (
              <>
                <p className="text-accent text-sm text-center px-4">{error}</p>
                <button
                  onClick={handleRetryCamera}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 text-xs font-mono font-semibold transition-all"
                >
                  <Camera className="h-4 w-4" />
                  Allow Camera & Start
                </button>
              </>
            ) : modelLoading ? (
              <p className="text-muted-foreground text-sm font-mono">Loading AI model, please wait...</p>
            ) : !isRunning ? (
              <p className="text-muted-foreground text-sm font-mono">Camera stopped — Click START to resume</p>
            ) : (
              <>
                <p className="text-muted-foreground text-sm font-mono">Starting camera...</p>
                <button
                  onClick={handleRetryCamera}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 text-xs font-mono font-semibold transition-all"
                >
                  <Camera className="h-4 w-4" />
                  Enable Camera
                </button>
              </>
            )}
          </div>
        )}

        {/* Video element */}
        <div style={{ display: showVideo ? "block" : "none", paddingTop: 32 }}>
          <video
            ref={videoRef}
            className="w-full block"
            playsInline
            muted
            autoPlay
          />
        </div>

        {/* Canvas overlay */}
        <canvas
          ref={canvasRef}
          className="absolute left-0 w-full pointer-events-none"
          style={{ top: 32, height: "calc(100% - 32px)", display: showVideo ? "block" : "none" }}
        />

        {/* Scan line */}
        {showVideo && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ top: 32 }}>
            <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent scan-line" />
          </div>
        )}
      </div>
    );
  }
);

WebcamDetector.displayName = "WebcamDetector";
export default WebcamDetector;
