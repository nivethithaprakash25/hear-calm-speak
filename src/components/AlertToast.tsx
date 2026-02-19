import { useEffect, useState } from "react";
import { X, AlertTriangle, Info, Siren } from "lucide-react";
import type { AlertEntry } from "@/types/alerts";

interface Props {
  alert: AlertEntry | null;
  onDismiss: () => void;
}

const severityConfig = {
  info: {
    border: "border-info/60",
    bg: "bg-info/10",
    icon: Info,
    iconColor: "text-info",
    label: "INFO",
    labelColor: "text-info",
    glow: "shadow-[0_0_20px_hsl(200_80%_55%/0.4)]",
  },
  warning: {
    border: "border-warning/60",
    bg: "bg-warning/10",
    icon: AlertTriangle,
    iconColor: "text-warning",
    label: "WARNING",
    labelColor: "text-warning",
    glow: "shadow-[0_0_20px_hsl(40_90%_55%/0.4)]",
  },
  danger: {
    border: "border-accent/60",
    bg: "bg-accent/10",
    icon: Siren,
    iconColor: "text-accent",
    label: "DANGER",
    labelColor: "text-accent",
    glow: "shadow-[0_0_24px_hsl(0_75%_55%/0.5)]",
  },
};

export default function AlertToast({ alert, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (alert) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alert, onDismiss]);

  if (!alert) return null;

  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  return (
    <div
      className={`
        fixed top-4 right-4 z-50 max-w-sm w-full
        rounded-lg border ${config.border} ${config.bg} ${config.glow}
        backdrop-blur-md p-4
        transition-all duration-300 ease-in-out
        ${visible ? "alert-slide-in opacity-100" : "opacity-0 translate-x-full"}
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${alert.severity === "danger" ? "voice-pulse" : ""}`}>
          <Icon className={`h-5 w-5 ${config.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-mono font-bold tracking-widest ${config.labelColor}`}>
              {config.label}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground ml-auto">{alert.time}</span>
          </div>
          <p className="text-xs font-mono text-foreground leading-relaxed">{alert.message}</p>
        </div>
        <button
          onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-0.5 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full ${config.iconColor.replace("text-", "bg-")} rounded-full`}
          style={{
            animation: "shrink 5s linear forwards",
          }}
        />
      </div>
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
