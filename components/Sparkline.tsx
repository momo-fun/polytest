import React from "react";

function normalize(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => (v - min) / range);
}

export default function Sparkline({
  data,
  color = "#5ef2d5",
  strokeWidth = 2
}: {
  data: number[];
  color?: string;
  strokeWidth?: number;
}) {
  if (!data || data.length < 2) {
    return (
      <svg className="sparkline" viewBox="0 0 100 40" role="img">
        <line x1="0" y1="20" x2="100" y2="20" stroke={color} strokeWidth={strokeWidth} opacity={0.4} />
      </svg>
    );
  }

  const normalized = normalize(data);
  const points = normalized
    .map((value, index) => {
      const x = (index / (normalized.length - 1)) * 100;
      const y = 40 - value * 36 - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="sparkline" viewBox="0 0 100 40" role="img">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
