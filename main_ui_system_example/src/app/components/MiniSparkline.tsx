import { LineChart, Line, ResponsiveContainer } from "recharts";

interface MiniSparklineProps {
  data: number[];
  color?: string;
  trend?: "up" | "down" | "stable";
}

export function MiniSparkline({ data, color = "#39c5bb", trend = "stable" }: MiniSparklineProps) {
  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <div className="relative h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={true}
            animationDuration={1000}
          />
        </LineChart>
      </ResponsiveContainer>
      {/* Trend indicator overlay */}
      <div className="absolute top-0 right-0">
        {trend === "up" && (
          <div className="text-xs text-[#059669]">↗</div>
        )}
        {trend === "down" && (
          <div className="text-xs text-[#fb7185]">↘</div>
        )}
      </div>
    </div>
  );
}
