import React, { useEffect, useRef, useState } from 'react';
import { ResultadoComparacion, SitioAmbiental } from '../lib/analogo';

interface CompositionPanelProps {
  sitioA: SitioAmbiental;
  sitioB: SitioAmbiental;
  resultado: ResultadoComparacion;
}

const CompCanvasBlock: React.FC<{
  titulo: string;
  subtitulo: string;
  compA: Record<string, number>;
  compB: Record<string, number>;
  similitud: number;
  tv: number;
}> = ({ titulo, subtitulo, compA, compB, similitud, tv }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [widthPx, setWidthPx] = useState<number>(480);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const claves = Array.from(new Set([...Object.keys(compA), ...Object.keys(compB)]));
  const sumA = Object.values(compA).reduce((a, b) => a + b, 0) || 1;
  const sumB = Object.values(compB).reduce((a, b) => a + b, 0) || 1;

  const rowH = 38;
  const padY = 14;
  const heightPx = Math.max(150, padY * 2 + claves.length * rowH);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 180) setWidthPx(w);
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
    canvas.width = Math.round(widthPx * dpr);
    canvas.height = Math.round(heightPx * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, widthPx, heightPx);

    const barX = 16;
    const barW = Math.max(80, widthPx - 32);

    claves.forEach((k, idx) => {
      const y = padY + idx * rowH;
      const pctA = ((compA[k] ?? 0) / sumA) * 100;
      const pctB = ((compB[k] ?? 0) / sumB) * 100;
      const diff = Math.abs(pctA - pctB);

      if (hoveredRow === idx) {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
        ctx.fillRect(6, y - 4, widthPx - 12, rowH - 2);
      }

      ctx.font = '600 11px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(k, barX, y + 8);

      ctx.font = '400 11px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#22D3EE';
      ctx.fillText(`${pctA.toFixed(1)}%`, widthPx - 140, y + 8);
      ctx.fillStyle = '#FBBF24';
      ctx.fillText(`${pctB.toFixed(1)}%`, widthPx - 76, y + 8);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`Δ${diff.toFixed(1)}%`, widthPx - 16, y + 8);
      ctx.textAlign = 'left';

      // Pista barra A (Cian)
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(barX, y + 14, barW, 5);
      ctx.fillStyle = '#06B6D4';
      ctx.fillRect(barX, y + 14, (Math.min(100, pctA) / 100) * barW, 5);

      // Pista barra B (Ámbar)
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(barX, y + 22, barW, 5);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(barX, y + 22, (Math.min(100, pctB) / 100) * barW, 5);
    });

    ctx.restore();
  }, [claves, compA, compB, sumA, sumB, widthPx, heightPx, hoveredRow]);

  return (
    <div className="bg-[#0D121D] border border-slate-800 rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-slate-100">{titulo}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{subtitulo}</p>
        </div>
        <div className="text-right font-mono tabular-nums">
          <div className="text-xl font-semibold text-cyan-300">
            {similitud.toFixed(1)}
            <span className="text-xs text-slate-400 ml-1">%</span>
          </div>
          <div className="text-[11px] text-slate-400">TV = {tv.toFixed(3)}</div>
        </div>
      </div>

      <div ref={containerRef} className="mt-4 w-full">
        <canvas
          ref={canvasRef}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relY = e.clientY - rect.top - padY;
            const idx = Math.floor(relY / rowH);
            setHoveredRow(idx >= 0 && idx < claves.length ? idx : null);
          }}
          onPointerLeave={() => setHoveredRow(null)}
          style={{ width: '100%', height: heightPx }}
          className="block rounded-md border border-slate-800 cursor-crosshair select-none"
          aria-label={titulo}
        />
      </div>
    </div>
  );
};

export const CompositionPanel: React.FC<CompositionPanelProps> = ({
  sitioA,
  sitioB,
  resultado,
}) => {
  return (
    <section id="composicion" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CompCanvasBlock
        titulo="Composición atmosférica / exosfera (Canvas)"
        subtitulo="Distancia de variación total sobre fracciones molares normalizadas"
        compA={sitioA.aire}
        compB={sitioB.aire}
        similitud={resultado.porVariable.aire}
        tv={resultado.tvAire}
      />
      <CompCanvasBlock
        titulo="Composición de suelo / regolito (Canvas)"
        subtitulo="Óxidos mayoritarios (% en peso normalizado)"
        compA={sitioA.suelo}
        compB={sitioB.suelo}
        similitud={resultado.porVariable.suelo}
        tv={resultado.tvSuelo}
      />
    </section>
  );
};
