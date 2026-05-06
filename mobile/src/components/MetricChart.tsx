import { Dimensions, View } from "react-native";
import { VictoryChart, VictoryLine, VictoryTheme } from "victory-native";

interface DataPoint { x: number; y: number }

interface MetricChartProps {
  data: DataPoint[];
  color?: string;
}

const SCREEN_WIDTH = Dimensions.get("window").width;

export function MetricChart({ data, color = "#3b82f6" }: MetricChartProps) {
  if (data.length < 2) return null;
  return (
    <View style={{ backgroundColor: "#0f172a", borderRadius: 10, overflow: "hidden" }}>
      <VictoryChart
        width={SCREEN_WIDTH - 48}
        height={160}
        theme={VictoryTheme.material}
        padding={{ top: 10, bottom: 30, left: 40, right: 10 }}
      >
        <VictoryLine
          data={data}
          style={{ data: { stroke: color, strokeWidth: 2 } }}
          interpolation="monotoneX"
        />
      </VictoryChart>
    </View>
  );
}
