import { useMemo } from "react";
import { Dimensions, Text, View } from "react-native";
import Svg, { Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { NN } from "../theme/tokens";

export interface SeriesPoint {
  t: number;
  y: number;
}

interface MonitoringSparklineProps {
  /** Time-ordered samples (ms epoch × value). */
  series: SeriesPoint[];
  color: string;
  height?: number;
  /** Optional y-axis label formatter. */
  formatY?: (y: number) => string;
}

const DEFAULT_H = 164;
const PAD_L = 42;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 26;

function monotonePath(xs: number[], ys: number[], w: number, h: number, minY: number, maxY: number): string {
  if (xs.length === 0) return "";
  const spanY = Math.max(maxY - minY, 1e-9);
  const nx = (i: number) => (xs.length <= 1 ? w / 2 : (xs[i] - xs[0]) / (xs[xs.length - 1] - xs[0] || 1)) * w;
  const ny = (v: number) => h - ((v - minY) / spanY) * h;

  if (xs.length === 1) {
    const x = nx(0);
    const y = ny(ys[0]);
    return `M ${x} ${y}`;
  }

  let d = `M ${nx(0)} ${ny(ys[0])}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = nx(i);
    const y0 = ny(ys[i]);
    const x1 = nx(i + 1);
    const y1 = ny(ys[i + 1]);
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  return d;
}

export function MonitoringSparkline({ series, color, height = DEFAULT_H, formatY = (y) => y.toFixed(1) }: MonitoringSparklineProps) {
  const width = Dimensions.get("window").width - 32;

  const { pathD, fillD, ticks, chartW, chartH, minY, maxY, timeLabels } = useMemo(() => {
    if (!series.length) {
      return { pathD: "", fillD: "", ticks: [] as number[], chartW: 0, chartH: 0, minY: 0, maxY: 1, timeLabels: [] as string[] };
    }
    const chartWInner = width - PAD_L - PAD_R;
    const chartHInner = height - PAD_T - PAD_B;
    const xs = series.map((p) => p.t);
    const yvals = series.map((p) => p.y);
    let min = Math.min(...yvals);
    let max = Math.max(...yvals);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const pad = (max - min) * 0.08;
    const minYInner = min - pad;
    const maxYInner = max + pad;
    const d = monotonePath(xs, yvals, chartWInner, chartHInner, minYInner, maxYInner);
    const fill =
      series.length >= 2
        ? `${d} L ${chartWInner} ${chartHInner} L 0 ${chartHInner} Z`
        : "";

    const nTicks = 4;
    const ticksInner: number[] = [];
    for (let i = 0; i < nTicks; i++) {
      const frac = i / (nTicks - 1 || 1);
      ticksInner.push(minYInner + frac * (maxYInner - minYInner));
    }

    const t0 = new Date(series[0].t);
    const tLast = new Date(series[series.length - 1].t);
    const mid = series[Math.floor(series.length / 2)];
    const tl = [
      t0.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      mid ? new Date(mid.t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "",
      tLast.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    ];

    return {
      pathD: d,
      fillD: fill,
      ticks: ticksInner,
      chartW: chartWInner,
      chartH: chartHInner,
      minY: minYInner,
      maxY: maxYInner,
      timeLabels: tl,
    };
  }, [series, height, width]);

  if (series.length < 2) {
    return (
      <View style={{ height, justifyContent: "center", borderRadius: 10, backgroundColor: NN.bgElevated }}>
        <Text style={{ color: NN.dim, fontSize: 12, paddingHorizontal: 12 }}>Yetersiz örnek — metrik bekleniyor</Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: NN.bgElevated, borderRadius: 10, borderWidth: 1, borderColor: NN.border, overflow: "hidden" }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="nnFillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {/* Grid */}
        {ticks.map((tick, idx) => {
          const span = maxY - minY || 1;
          const fy = (tick - minY) / span;
          const gy = PAD_T + (1 - fy) * chartH;
          return (
            <Line
              key={idx}
              x1={PAD_L}
              y1={gy}
              x2={PAD_L + chartW}
              y2={gy}
              stroke={NN.border}
              strokeDasharray="4 6"
              strokeOpacity={0.85}
            />
          );
        })}

        {fillD ? <Path d={fillD} fill="url(#nnFillGrad)" transform={`translate(${PAD_L},${PAD_T})`} /> : null}
        <Path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={`translate(${PAD_L},${PAD_T})`}
        />

        {/* Y labels */}
        {ticks.map((tick, idx) => {
          const span = maxY - minY || 1;
          const fy = (tick - minY) / span;
          const gy = PAD_T + (1 - fy) * chartH;
          return (
            <SvgText key={`yl-${idx}`} x={4} y={gy + 4} fill={NN.dim} fontSize={10}>
              {formatY(tick)}
            </SvgText>
          );
        })}

        {/* Time labels */}
        <SvgText x={PAD_L} y={height - 8} fill={NN.muted} fontSize={10}>
          {timeLabels[0]}
        </SvgText>
        <SvgText x={PAD_L + chartW / 2 - 16} y={height - 8} fill={NN.muted} fontSize={10}>
          {timeLabels[1]}
        </SvgText>
        <SvgText x={PAD_L + chartW - 36} y={height - 8} fill={NN.muted} fontSize={10}>
          {timeLabels[2]}
        </SvgText>
      </Svg>
    </View>
  );
}
