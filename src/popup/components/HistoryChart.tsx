import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { buildBuckets } from "../../lib/focusScore";
import type { ScoreHistory } from "../../types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

interface HistoryChartProps {
  history: ScoreHistory;
}

// Chart.js draws into a <canvas>: CSS variables are not resolved there.
// So we pick real colors based on the system light/dark theme.
function chartOptions(): ChartOptions<"line"> {
  const dark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const tickColor = dark ? "#9ca3af" : "#6b7280";
  const gridColor = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: { stepSize: 25, color: tickColor },
        grid: { color: gridColor },
      },
      x: {
        ticks: { color: tickColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
        grid: { display: false },
      },
    },
  };
}

/** Chart of the focus score evolution over the day (30-min buckets). */
export function HistoryChart({ history }: HistoryChartProps) {
  const buckets = buildBuckets(history);

  if (buckets.length < 2) {
    return <p className="chart__empty">Not enough data today yet to draw a chart.</p>;
  }

  const data: ChartData<"line"> = {
    labels: buckets.map((bucket) => bucket.label),
    datasets: [
      {
        data: buckets.map((bucket) => bucket.score),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.15)",
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        borderWidth: 2,
      },
    ],
  };

  return (
    <div className="chart">
      <Line data={data} options={chartOptions()} />
    </div>
  );
}
