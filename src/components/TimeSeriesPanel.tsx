import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatoCientifico, ResultadoComparacion } from '../lib/analogo';

type CanalSerie = 'temperatura' | 'presion' | 'viento' | 'luz';

interface TimeSeriesPanelProps {
  resultado: ResultadoComparacion;
}

const CANALES: {
  id: CanalSerie;
  titulo: string;
  unidad: string;
  permiteLog?: boolean;
}[] = [
  { id: 'temperatura', titulo: 'Temperatura', unidad: 'K' },
  { id: 'presion', titulo: 'Presión atmosférica', unidad: 'Pa', permiteLog: true },
  { id: 'viento', titulo: 'Velocidad del viento', unidad: 'm/s' },
  { id: 'luz', titulo: 'Irradiancia solar', unidad: 'W/m²' },
];

export const TimeSeriesPanel: React.FC<TimeSeriesPanelProps> = ({ resultado }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [canal, setCanal] = useState<CanalSerie>('temperatura');
  const [escalaLog, setEscalaLog] = useState<boolean>(true);
  const [probeIdx, setProbeIdx] = useState<number | null>(null);
  const [widthPx, setWidthPx] = useState<number>(760);

  const meta = CANALES.find((c) => c.id === canal)!;
  const usarLog = canal === 'presion' && escalaLog;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 200) setWidthPx(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const computed = useMemo(() => {
    const rawA = resultado.seriesA[canal];
    const rawB = resultado.seriesB[canal];
    const len = rawA.length;

    const transform = (v: number) =>
      usarLog ? Math.log10(Math.max(v, 1e-12)) : v;

    const valsA = rawA.map(transform);
    const valsB = rawB.map(transform);

    let minVal = Math.min(...valsA, ...valsB);
    let maxVal = Math.max(...valsA, ...valsB);

    if (Math.abs(maxVal - minVal) < 1e-9) {
      minVal -= 1;
      maxVal += 1;
    } else {
      const pad = (maxVal - minVal) * 0.08;
      minVal -= pad;
      maxVal += pad;
    }

    return {
      yA: rawA,
      yB: rawB,
      valsA,
      valsB,
      minY: minVal,
      maxY: maxVal,
      n: len,
    };
  }, [resultado, canal, usarLog]);

  const H = 264;
  const mL = 68;
  const mR = 20;
  const mT = 18;
  const mB = 34;
  const plotW = Math.max(80, widthPx - mL - mR);
  const plotH = H - mT - mB;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(widthPx * dpr);
    canvas.height = Math.round(H * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { valsA, valsB, minY, maxY, n } = computed;
    const xOf = (i: number) => mL + (i / Math.max(1, n - 1)) * plotW;
    const yOf = (val: number) =>
      mT + plotH - ((val - minY) / (maxY - minY)) * plotH;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, widthPx, H);

    // Rejilla horizontal y etiquetas Y
    ctx.font = '400 10px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const val = minY + f * (maxY - minY);
      const y = yOf(val);
      const displayVal = usarLog ? Math.pow(10, val) : val;
      const label = usarLog
        ? `10^${val.toFixed(1)}`
        : formatoCientifico(displayVal, meta.unidad);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mL, y);
      ctx.lineTo(widthPx - mR, y);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'right';
      ctx.fillText(label, mL - 8, y);
    }

    // Rejilla vertical y etiquetas X
    ctx.textBaseline = 'alphabetic';
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const idx = Math.round(f * (n - 1));
      const x = xOf(idx);
      const label =
        resultado.modo === 'ciclo'
          ? `${Math.round(f * 100)}%`
          : `${resultado.seriesA.t[idx]?.toFixed(0) ?? 0} h`;

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.beginPath();
      ctx.moveTo(x, mT);
      ctx.lineTo(x, H - mB);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, H - 12);
    }

    // Marco
    ctx.strokeStyle = '#1E293B';
    ctx.strokeRect(mL, mT, plotW, plotH);

    // Área sutil bajo curva A
    ctx.beginPath();
    valsA.forEach((v, i) => {
      const px = xOf(i);
      const py = yOf(v);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.lineTo(xOf(n - 1), mT + plotH);
    ctx.lineTo(xOf(0), mT + plotH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
    ctx.fill();

    // Curva Sitio A (Cian sólida)
    ctx.beginPath();
    valsA.forEach((v, i) => {
      const px = xOf(i);
      const py = yOf(v);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Curva Sitio B (Ámbar discontinua)
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    valsB.forEach((v, i) => {
      const px = xOf(i);
      const py = yOf(v);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    // Sonda interactiva
    if (probeIdx !== null) {
      const px = xOf(probeIdx);
      const pyA = yOf(valsA[probeIdx]);
      const pyB = yOf(valsB[probeIdx]);

      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, mT);
      ctx.lineTo(px, H - mB);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.arc(px, pyA, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#07090E';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(px, pyB, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }, [computed, widthPx, probeIdx, resultado, usarLog, meta.unidad, plotW, plotH]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const clamped = Math.max(mL, Math.min(widthPx - mR, relX));
    const frac = (clamped - mL) / plotW;
    const idx = Math.round(frac * (computed.n - 1));
    setProbeIdx(Math.max(0, Math.min(computed.n - 1, idx)));
  };

  const correlacion = resultado.correlacionTemporal[canal];
  const similitud = resultado.porVariable[canal];

  return (
    <section
      id="series-temporales"
      className="bg-[#0D121D] border border-slate-800 rounded-lg p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Osciloscopio Canvas de Series Temporales
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {resultado.modo === 'ciclo'
              ? 'Eje horizontal normalizado al día local completo de cada cuerpo (0–100%)'
              : `Ventana absoluta (${resultado.ventana[0]} h – ${resultado.ventana[1]} h) · ${resultado.n} muestras`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
            {CANALES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCanal(c.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                  canal === c.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {c.titulo}
              </button>
            ))}
          </div>

          {meta.permiteLog && (
            <button
              type="button"
              onClick={() => setEscalaLog((prev) => !prev)}
              className={`px-3 py-1.5 text-xs font-mono rounded-md border whitespace-nowrap shrink-0 transition-colors ${
                escalaLog
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-100'
              }`}
            >
              {escalaLog ? 'Escala log₁₀' : 'Escala lineal'}
            </button>
          )}
        </div>
      </div>

      {/* Leyenda y métricas del canal activo */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 bg-cyan-400" aria-hidden="true" />
            <span className="font-medium text-slate-200">{resultado.sitioA}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-4 h-0.5 border-t-2 border-dashed border-amber-400"
              aria-hidden="true"
            />
            <span className="font-medium text-slate-200">{resultado.sitioB}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono tabular-nums text-slate-400">
          <span>
            Similitud Wasserstein:{' '}
            <strong className="text-cyan-300">{similitud.toFixed(1)}%</strong>
          </span>
          <span>·</span>
          <span>
            Forma temporal (r):{' '}
            <strong className="text-slate-100">
              {correlacion !== null
                ? `${correlacion >= 0 ? '+' : ''}${correlacion.toFixed(2)}`
                : 'N/A (constante)'}
            </strong>
          </span>
        </div>
      </div>

      <div ref={containerRef} className="relative w-full">
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setProbeIdx(null)}
          style={{ width: '100%', height: H }}
          className="block rounded-md border border-slate-800 cursor-crosshair select-none"
          aria-label={`Osciloscopio Canvas de ${meta.titulo}`}
        />

        <div className="mt-2 min-h-[30px] px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs font-mono tabular-nums flex flex-wrap items-center justify-between gap-3 text-slate-300">
          {probeIdx !== null ? (
            <>
              <span>
                {resultado.modo === 'ciclo'
                  ? `Ciclo: ${((probeIdx / Math.max(1, computed.n - 1)) * 100).toFixed(1)}% (A: ${resultado.seriesA.t[probeIdx].toFixed(1)} h · B: ${resultado.seriesB.t[probeIdx].toFixed(1)} h)`
                  : `t = ${resultado.seriesA.t[probeIdx].toFixed(2)} h`}
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-cyan-400">
                  A: {formatoCientifico(computed.yA[probeIdx], meta.unidad)} {meta.unidad}
                </span>
                <span className="text-amber-400">
                  B: {formatoCientifico(computed.yB[probeIdx], meta.unidad)} {meta.unidad}
                </span>
              </div>
            </>
          ) : (
            <span className="text-slate-500">
              Desliza el cursor sobre el lienzo Canvas para inspeccionar coordenadas exactas (t, y)
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
