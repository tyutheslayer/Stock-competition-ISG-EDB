// components/insights/LineChartInsight.jsx
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export default function LineChartInsight({
  title,
  data,
  dataKey = "value",
  unit = "",
}) {
  if (!Array.isArray(data) || data.length === 0) return null;

  return (
    <div className="rounded-2xl bg-base-100/40 border border-white/10 p-4">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div style={{ width: "100%", height: 180 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(v) =>
                unit ? `${Number(v).toFixed(2)} ${unit}` : Number(v).toFixed(2)
              }
            />
            <ReferenceLine y={0} stroke="#999" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="#ffd700"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}