// components/insights/LineChartInsight.jsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

export default function LineChartInsight({ data }) {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeOpacity={0.15} vertical={false} />
          <XAxis dataKey="label" stroke="currentColor" opacity={0.7} />
          <YAxis stroke="currentColor" opacity={0.7} />
          <Tooltip
            contentStyle={{ background: "rgba(20,20,20,0.9)", border: "1px solid rgba(255,215,0,0.3)" }}
            labelStyle={{ color: "#ffe8a3" }}
          />
          <Line type="monotone" dataKey="value" stroke="#ffd873" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}