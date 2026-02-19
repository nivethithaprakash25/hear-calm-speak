import { useState, useCallback, useRef, useEffect } from "react";
import { Shield, Radio, Play, Square, Volume2, VolumeX } from "lucide-react";
import WebcamDetector, { type DetectionStats, type WebcamHandle } from "@/components/WebcamDetector";
import StatsPanel from "@/components/StatsPanel";
import CrowdChart, { type CrowdDataPoint } from "@/components/CrowdChart";
import CrowdHistory, { type HistoryEntry } from "@/components/CrowdHistory";
import AlertToast from "@/components/AlertToast";
import { useVoiceAlert } from "@/hooks/useVoiceAlert";
import type { AlertEntry } from "@/types/alerts";
export type { AlertEntry } from "@/types/alerts";

const Index = () => {
  const [stats, setStats] = useState<DetectionStats>({
    currentCount: 0,
    totalIn: 0,
    totalOut: 0,
    peakCount: 0,
    detections: [],
    childCount: 0,
    adultCount: 0,
  });
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [toastAlert, setToastAlert] = useState<AlertEntry | null>(null);
  const [chartData, setChartData] = useState<CrowdDataPoint[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const webcamRef = useRef<WebcamHandle>(null);
  const statsSnapshotRef = useRef(stats);
  const { speak, toggleVoice, voiceEnabled, isSpeaking } = useVoiceAlert();

  // Keep snapshot ref updated
  useEffect(() => {
    statsSnapshotRef.current = stats;
  }, [stats]);

  // Record chart data every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRunning) return;
      const s = statsSnapshotRef.current;
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setChartData((prev) => {
        const next = [...prev, { time: now, count: s.currentCount, totalIn: s.totalIn, totalOut: s.totalOut }];
        return next.slice(-60);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Record history snapshot every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRunning) return;
      const s = statsSnapshotRef.current;
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setHistory((prev) => {
        const next = [...prev, { timestamp: now, currentCount: s.currentCount, totalIn: s.totalIn, totalOut: s.totalOut, peakCount: s.peakCount }];
        return next.slice(-100);
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleStatsUpdate = useCallback((s: DetectionStats) => {
    setStats(s);
  }, []);

  const handleAlert = useCallback((message: string, severity: "info" | "warning" | "danger") => {
    const now = new Date().toLocaleTimeString();
    const entry: AlertEntry = { time: now, message, severity };

    setAlerts((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].message === message) return prev;
      return [...prev, entry].slice(-50);
    });

    // Show toast notification
    setToastAlert(entry);

    // Voice announcement
    const cooldown = severity === "danger" ? 6000 : severity === "warning" ? 10000 : 15000;
    speak(message, cooldown);
  }, [speak]);

  const toggleCamera = () => {
    setIsRunning((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Floating alert toast */}
      <AlertToast alert={toastAlert} onDismiss={() => setToastAlert(null)} />

      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg glow-primary">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">CrowdGuard AI</h1>
            <p className="text-xs text-muted-foreground font-mono">Smart Crowd Management System</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Voice toggle */}
          <button
            onClick={toggleVoice}
            title={voiceEnabled ? "Disable voice alerts" : "Enable voice alerts"}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-semibold transition-all ${
              voiceEnabled
                ? isSpeaking
                  ? "bg-primary/20 text-primary border border-primary/50 voice-pulse"
                  : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                : "bg-muted text-muted-foreground border border-border hover:bg-secondary"
            }`}
          >
            {voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{voiceEnabled ? (isSpeaking ? "SPEAKING" : "VOICE ON") : "VOICE OFF"}</span>
          </button>

          {/* Start/Stop */}
          <button
            onClick={toggleCamera}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-semibold transition-all ${
              isRunning
                ? "bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25"
                : "bg-success/15 text-success border border-success/30 hover:bg-success/25"
            }`}
          >
            {isRunning ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {isRunning ? "STOP" : "START"}
          </button>

          {/* System status */}
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
            <Radio className={`h-3 w-3 ${isRunning ? "text-success pulse-dot" : "text-muted-foreground"}`} />
            <span className={`text-xs font-mono ${isRunning ? "text-success" : "text-muted-foreground"}`}>
              {isRunning ? "SYSTEM ACTIVE" : "SYSTEM PAUSED"}
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Webcam feed */}
        <div className="lg:col-span-2 space-y-4">
          <WebcamDetector
            ref={webcamRef}
            onStatsUpdate={handleStatsUpdate}
            onAlert={handleAlert}
            isRunning={isRunning}
          />
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground px-1">
            <span>TensorFlow.js + COCO-SSD • Real-time Detection</span>
            <span>Counts persist when no one is visible</span>
          </div>

          {/* Chart */}
          <CrowdChart data={chartData} />

          {/* History table */}
          <CrowdHistory history={history} />
        </div>

        {/* Stats panel */}
        <div className="lg:col-span-1">
          <StatsPanel stats={stats} alerts={alerts} />
        </div>
      </div>
    </div>
  );
};

export default Index;
