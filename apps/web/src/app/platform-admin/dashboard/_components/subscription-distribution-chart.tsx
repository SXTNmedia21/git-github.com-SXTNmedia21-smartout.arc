"use client";

// Renders subscription status distribution with deferred chart JS loading.
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

type SubscriptionDistribution = {
  name: string;
  value: number;
  color: string;
};

type SubscriptionDistributionChartProps = {
  data: SubscriptionDistribution[];
};

/**
 * Shows a pie chart for non-zero subscription buckets.
 * This lives in a separate chunk so dashboard hydration stays lighter.
 */
export function SubscriptionDistributionChart({ data }: SubscriptionDistributionChartProps) {
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              color: "hsl(var(--popover-foreground))",
              fontSize: "12px",
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
