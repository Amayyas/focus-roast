import { scoreTier, tierColor } from "../../lib/focusScore";

interface ScoreGaugeProps {
  score: number;
}

const SIZE = 120;
const STROKE = 11;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Circular SVG gauge showing the current score, with color code. */
export function ScoreGauge({ score }: ScoreGaugeProps) {
  const color = tierColor(scoreTier(score));
  const offset = CIRCUMFERENCE * (1 - score / 100);

  return (
    <div className="gauge">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--track)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.6s ease" }}
        />
      </svg>
      <div className="gauge__value" style={{ color }}>
        <span className="gauge__number">{score}</span>
        <span className="gauge__label">focus</span>
      </div>
    </div>
  );
}
