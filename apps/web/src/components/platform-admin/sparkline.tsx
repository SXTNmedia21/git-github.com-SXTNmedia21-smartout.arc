"use client";

import { ResponsiveContainer, LineChart, Line } from "recharts";

type SparklineProps = {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
};

export function Sparkline({
  data,
  color = "hsl(var(--primary))",
  height = 32,
  width = 80,
}: SparklineProps) {
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
