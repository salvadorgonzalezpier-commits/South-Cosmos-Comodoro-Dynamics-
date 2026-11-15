import React, { useState } from 'react';
import {
  METADATOS_VARIABLES,
  ORDEN_VARIABLES,
  ResultadoComparacion,
  VariableAnalogo,
} from '../lib/analogo';

interface RadarChartProps {
  resultado: ResultadoComparacion;
  pesos: Record<VariableAnalogo, number>;
  criticas: VariableAnalogo[];
}

export const RadarChart: React.FC<RadarChartProps> = ({
  resultado,
  pesos,
  criticas,
}) => {
  const [hoveredVar, setHoveredVar] = useState<VariableAnalogo | null>(null);

  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 142;
  const levels = [20, 40, 60, 80, 100];
  const count = ORDEN_VARIABLES.length;

  const angleFor = (idx: number) => (Math.PI * 2 * idx) / count - Math.PI / 2;

  const pointAt = (idx: number, pct: number) => {
    const a = angleFor(idx);
    const r = (pct / 100) * radius;
    return {
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a),
    };
  };

  const polygonPoints = (pct: number) =>
    ORDEN_VARIABLES.map((_, idx) => {
      const p = pointAt(idx, pct);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ');

  const dataPoints = ORDEN_VARIABLES.map((v, idx) => {
    const val = resultado.porVariable[v];
    return pointAt(idx, val);
  });

  const dataPolygon = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const hoveredScore = hoveredVar ? resultado.porVariable[hoveredVar] : null;

  return (
    <div className="relative flex flex-col items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[400px] h-auto select-none"
        role="img"
        aria-label="Gráfico radar de similitud ambiental por variable"
      >
        {/* Anillos poligonales de calibración */}
        {levels.map((lvl) => (
          <polygon
            key={lvl}
            points={polygonPoints(lvl)}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={lvl === 100 ? 1.25 : 1}
          />
        ))}

        {/* Ejes radiales */}
        {ORDEN_VARIABLES.map((v, idx) => {
          const outer = pointAt(idx, 100);
          const isCritica = criticas.includes(v);
          return (
            <line
              key={v}
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              stroke={isCritica ? '#CBD5E1' : '#E2E8F0'}
              strokeWidth={1}
              strokeDasharray={isCritica ? undefined : '2 2'}
            />
          );
        })}

        {/* Etiquetas de escala en eje vertical */}
        {levels.map((lvl) => (
          <text
            key={`lbl-${lvl}`}
            x={cx + 4}
            y={cy - (lvl / 100) * radius + 3}
            className="fill-slate-400 font-mono text-[9px] tabular-nums"
          >
            {lvl}%
          </text>
        ))}

        {/* Polígono de datos */}
        <polygon
          points={dataPolygon}
          fill="rgba(37, 99, 235, 0.14)"
          stroke="#2563EB"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Vértices interactivos y etiquetas */}
        {ORDEN_VARIABLES.map((v, idx) => {
          const p = dataPoints[idx];
          const labelPt = pointAt(idx, 118);
          const angle = angleFor(idx);
          const cos = Math.cos(angle);
          const anchor =
            Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
          const isCrit = criticas.includes(v);
          const isHovered = hoveredVar === v;
          const val = resultado.porVariable[v];

          return (
            <g
              key={v}
              onMouseEnter={() => setHoveredVar(v)}
              onMouseLeave={() => setHoveredVar(null)}
              className="cursor-pointer"
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 6 : 4}
                fill={isCrit && val < 25 ? '#D97706' : '#2563EB'}
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
              <text
                x={labelPt.x}
                y={labelPt.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                className={`font-sans text-[11px] font-medium transition-colors ${
                  isHovered ? 'fill-blue-700 font-semibold' : 'fill-slate-700'
                }`}
              >
                {METADATOS_VARIABLES[v].etiqueta}
                {isCrit ? ' *' : ''}
              </text>
              <text
                x={labelPt.x}
                y={labelPt.y + 13}
                textAnchor={anchor}
                dominantBaseline="middle"
                className="font-mono text-[10px] tabular-nums fill-slate-500"
              >
                {val.toFixed(1)}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* Lectura de precisión al pasar el cursor */}
      <div className="mt-2 h-6 flex items-center justify-center text-xs font-mono tabular-nums text-slate-600">
        {hoveredVar && hoveredScore !== null ? (
          <span>
            {METADATOS_VARIABLES[hoveredVar].etiqueta}:{' '}
            <strong className="text-slate-900">{hoveredScore.toFixed(2)}%</strong> · peso{' '}
            {pesos[hoveredVar]}
            {criticas.includes(hoveredVar) ? ' · variable crítica' : ''}
          </span>
        ) : (
          <span className="text-slate-400">
            * Variables críticas ({criticas.map((c) => METADATOS_VARIABLES[c].etiqueta).join(', ')})
          </span>
        )}
      </div>
    </div>
  );
};
