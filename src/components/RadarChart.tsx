import React, { useEffect, useRef, useState } from 'react';
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

const SHORT_LABELS: Record<VariableAnalogo, string> = {
  temperatura: 'Temperatura',
  presion: 'Presión',
  viento: 'Viento',
  luz: 'Irradiancia',
  gravedad: 'Gravedad',
  radiacion: 'Radiación',
  aire: 'Aire',
  suelo: 'Suelo',
  terreno: 'Terreno',
};

export const RadarChart: React.FC<RadarChartProps> = ({
  resultado,
  pesos,
  criticas,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredVar, setHoveredVar] = useState<VariableAnalogo | null>(null);
  const [sizePx, setSizePx] = useState<number>(380);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      setSizePx(Math.max(260, Math.min(420, w)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(sizePx * dpr);
    canvas.height = Math.round(sizePx * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0D121D';
    ctx.fillRect(0, 0, sizePx, sizePx);

    const cx = sizePx / 2;
    const cy = sizePx / 2;
    const radius = sizePx * 0.32;
    const count = ORDEN_VARIABLES.length;
    const angleFor = (idx: number) => (Math.PI * 2 * idx) / count - Math.PI / 2;
    const pointAt = (idx: number, pct: number) => {
      const a = angleFor(idx);
      const r = (pct / 100) * radius;
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    };

    // Anillos poligonales de calibración
    const levels = [20, 40, 60, 80, 100];
    for (const lvl of levels) {
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const pt = pointAt(i, lvl);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.strokeStyle =
        lvl === 100 ? 'rgba(148, 163, 184, 0.28)' : 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = lvl === 100 ? 1.2 : 1;
      ctx.stroke();

      ctx.font = '400 9px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillStyle = '#64748B';
      ctx.fillText(`${lvl}%`, cx + 4, cy - (lvl / 100) * radius + 3);
    }

    // Ejes radiales
    ORDEN_VARIABLES.forEach((v, idx) => {
      const outer = pointAt(idx, 100);
      const isCrit = criticas.includes(v);
      ctx.save();
      ctx.strokeStyle = isCrit
        ? 'rgba(245, 158, 11, 0.35)'
        : 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = 1;
      if (!isCrit) ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(outer.x, outer.y);
      ctx.stroke();
      ctx.restore();
    });

    // Polígono de similitud
    ctx.beginPath();
    const dataPts = ORDEN_VARIABLES.map((v, idx) =>
      pointAt(idx, resultado.porVariable[v])
    );
    dataPts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 182, 212, 0.18)';
    ctx.fill();
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Vértices y etiquetas
    ORDEN_VARIABLES.forEach((v, idx) => {
      const p = dataPts[idx];
      const labelPt = pointAt(idx, 123);
      const angle = angleFor(idx);
      const cos = Math.cos(angle);
      const val = resultado.porVariable[v];
      const isCrit = criticas.includes(v);
      const isHovered = hoveredVar === v;

      ctx.beginPath();
      ctx.arc(p.x, p.y, isHovered ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isCrit && val < 25 ? '#F59E0B' : '#06B6D4';
      ctx.fill();
      ctx.strokeStyle = '#07090E';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = Math.abs(cos) < 0.2 ? 'center' : cos > 0 ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.font = `${isHovered ? 600 : 500} 11px "IBM Plex Sans", sans-serif`;
      ctx.fillStyle = isHovered ? '#22D3EE' : '#E2E8F0';
      ctx.fillText(`${SHORT_LABELS[v]}${isCrit ? ' *' : ''}`, labelPt.x, labelPt.y - 6);

      ctx.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillStyle = isCrit && val < 25 ? '#FBBF24' : '#94A3B8';
      ctx.fillText(`${val.toFixed(1)}%`, labelPt.x, labelPt.y + 7);
    });

    ctx.restore();
  }, [resultado, criticas, hoveredVar, sizePx]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = sizePx / 2;
    const cy = sizePx / 2;
    const radius = sizePx * 0.32;
    const count = ORDEN_VARIABLES.length;

    let closest: VariableAnalogo | null = null;
    let bestDist = 28;
    ORDEN_VARIABLES.forEach((v, idx) => {
      const ang = (Math.PI * 2 * idx) / count - Math.PI / 2;
      const r = (resultado.porVariable[v] / 100) * radius;
      const px = cx + r * Math.cos(ang);
      const py = cy + r * Math.sin(ang);
      const d = Math.hypot(x - px, y - py);
      if (d < bestDist) {
        bestDist = d;
        closest = v;
      }
    });
    setHoveredVar(closest);
  };

  const hoveredScore = hoveredVar ? resultado.porVariable[hoveredVar] : null;

  return (
    <div ref={containerRef} className="relative flex flex-col items-center w-full">
      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoveredVar(null)}
        style={{ width: sizePx, height: sizePx }}
        className="block rounded-md border border-slate-800 cursor-crosshair select-none"
        aria-label="Gráfico radar de similitud ambiental en Canvas"
      />

      <div className="mt-2.5 h-6 flex items-center justify-center text-xs font-mono tabular-nums text-slate-400">
        {hoveredVar && hoveredScore !== null ? (
          <span>
            {METADATOS_VARIABLES[hoveredVar].etiqueta}:{' '}
            <strong className="text-cyan-300">{hoveredScore.toFixed(2)}%</strong> · peso{' '}
            {pesos[hoveredVar]}
            {criticas.includes(hoveredVar) ? ' · variable crítica' : ''}
          </span>
        ) : (
          <span>
            * Críticas ({criticas.map((c) => METADATOS_VARIABLES[c].etiqueta).join(', ')})
          </span>
        )}
      </div>
    </div>
  );
};
