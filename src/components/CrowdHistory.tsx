import { Clock } from "lucide-react";

export interface HistoryEntry {
  timestamp: string;
  currentCount: number;
  totalIn: number;
  totalOut: number;
  peakCount: number;
}

interface Props {
  history: HistoryEntry[];
}

export default function CrowdHistory({ history }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-info" />
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Crowd History Log
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-2 px-2">Time</th>
              <th className="text-right py-2 px-2">Count</th>
              <th className="text-right py-2 px-2">In</th>
              <th className="text-right py-2 px-2">Out</th>
              <th className="text-right py-2 px-2">Peak</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4 text-muted-foreground">
                  No history yet — data records every 10s
                </td>
              </tr>
            ) : (
              history.slice().reverse().map((h, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-1.5 px-2 text-secondary-foreground">{h.timestamp}</td>
                  <td className="py-1.5 px-2 text-right text-primary font-bold">{h.currentCount}</td>
                  <td className="py-1.5 px-2 text-right text-success">{h.totalIn}</td>
                  <td className="py-1.5 px-2 text-right text-warning">{h.totalOut}</td>
                  <td className="py-1.5 px-2 text-right text-info">{h.peakCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
