import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export interface CrowdDataPoint {
  time: string;
  count: number;
  totalIn: number;
  totalOut: number;
}

interface Props {
  data: CrowdDataPoint[];
}

export default function CrowdChart({ data }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">
        Crowd Density Over Time
      </h3>
      <div className="h-48">
        {data.length < 2 ? (
          <div className="flex items-center justify-center h-full text-xs font-mono text-muted-foreground">
            Collecting data points...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="countGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(185, 80%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(185, 80%, 50%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(145, 70%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(145, 70%, 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 18%)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)", fontFamily: "JetBrains Mono" }}
                interval="preserveStartEnd"
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)", fontFamily: "JetBrains Mono" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(220, 18%, 10%)",
                  border: "1px solid hsl(220, 16%, 18%)",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontFamily: "JetBrains Mono",
                  color: "hsl(210, 20%, 92%)",
                }}
                labelStyle={{ color: "hsl(215, 15%, 55%)" }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="Count"
                stroke="hsl(185, 80%, 50%)"
                strokeWidth={2}
                fill="url(#countGrad)"
              />
              <Area
                type="monotone"
                dataKey="totalIn"
                name="Total In"
                stroke="hsl(145, 70%, 45%)"
                strokeWidth={1.5}
                fill="url(#inGrad)"
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
