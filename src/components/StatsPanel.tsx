import { Users, LogIn, LogOut, TrendingUp, AlertTriangle, Clock, BellRing } from "lucide-react";
import type { DetectionStats } from "./WebcamDetector";
import type { AlertEntry } from "@/types/alerts";

interface Props {
  stats: DetectionStats;
  alerts: AlertEntry[];
}

const severityStyles = {
  info: "text-info bg-info/10 border-info/20",
  warning: "text-warning bg-warning/10 border-warning/20",
  danger: "text-accent bg-accent/10 border-accent/20",
};

const severityDot = {
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-accent pulse-dot",
};

export default function StatsPanel({ stats, alerts }: Props) {
  const cards = [
    {
      label: "Current Count",
      value: stats.currentCount,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
      border: stats.currentCount > 5 ? "border-accent glow-danger" : "border-border",
    },
    {
      label: "Total In",
      value: stats.totalIn,
      icon: LogIn,
      color: "text-success",
      bg: "bg-success/10",
      border: "border-border",
    },
    {
      label: "Total Out",
      value: stats.totalOut,
      icon: LogOut,
      color: "text-warning",
      bg: "bg-warning/10",
      border: "border-border",
    },
    {
      label: "Peak Count",
      value: stats.peakCount,
      icon: TrendingUp,
      color: "text-info",
      bg: "bg-info/10",
      border: "border-border",
    },
  ];

  const dangerCount = alerts.filter((a) => a.severity === "danger").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-lg border ${card.border} bg-card p-4 transition-all`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`${card.bg} p-1.5 rounded-md`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                {card.label}
              </span>
            </div>
            <div className={`text-3xl font-bold font-mono ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <BellRing className={`h-4 w-4 ${alerts.length > 0 ? "text-accent" : "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Alerts
          </span>
          {alerts.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5">
              {dangerCount > 0 && (
                <span className="text-[10px] font-mono bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">
                  {dangerCount} danger
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-[10px] font-mono bg-warning/20 text-warning px-1.5 py-0.5 rounded-full">
                  {warningCount} warn
                </span>
              )}
            </div>
          )}
        </div>
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono">No alerts</p>
          ) : (
            alerts.slice(-10).reverse().map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-xs font-mono rounded-md border px-2 py-1.5 ${severityStyles[alert.severity]}`}
              >
                <span className={`h-1.5 w-1.5 mt-1.5 rounded-full shrink-0 ${severityDot[alert.severity]}`} />
                <div className="flex-1 min-w-0">
                  <span className="opacity-60">[{alert.time}]</span>{" "}
                  <span className="break-words">{alert.message}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detection info */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Live Detections
          </span>
          {stats.detections.length > 0 && (
            <span className="ml-auto text-xs font-mono bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
              {stats.detections.length} person{stats.detections.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {stats.detections.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono">
              Counts persist • Waiting for detections...
            </p>
          ) : (
            stats.detections.map((d, i) => (
              <div
                key={i}
                className="flex justify-between text-xs font-mono text-secondary-foreground bg-secondary/50 rounded px-2 py-1"
              >
                <span>Person {i + 1}</span>
                <span className="text-primary">{Math.round(d.score * 100)}%</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
