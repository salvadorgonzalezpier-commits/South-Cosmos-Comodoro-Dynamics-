import React, { useMemo, useState } from 'react';
import {
  formatoCientifico,
  ResultadoComparacion,
} from '../lib/analogo';

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
  const [canal, setCanal] = useState<CanalSerie>('temperatura');
  const [escalaLog, setEscalaLog] = useState<boolean>(true);
  const [probeIdx, setProbeIdx] = useState<number | null>(null);

  const meta = CANALES.find((c) => c.id === canal)!;
  const usarLog = canal === 'presion' && escalaLog;

  const {
    yA,
    yB,
    minY,
    maxY,
    pathA,
    pathB,
    ticksY,
    ticksX,
    n,
  } = useMemo(() => {
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

    const W = 760;
    const H = 260;
    const mL = 68;
    const mR = 20;
    const mT = 18;
    const mB = 34;
    const plotW = W - mL - mR;
    const plotH = H - mT - mB;

    const xOf = (i: number) => mL + (i / Math.max(1, len - 1)) * plotW;
    const yOf = (val: number) =>
      mT + plotH - ((val - minVal) / (maxVal - minVal)) * plotH;

    const buildPath = (arr: number[]) =>
      arr
        .map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`)
        .join(' ');

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const val = minVal + f * (maxVal - minVal);
      const displayVal = usarLog ? Math.pow(10, val) : val;
      return {
        y: yOf(val),
        label: usarLog
          ? `10^${val.toFixed(1)}`
          : formatoCientifico(displayVal, meta.unidad),
      };
    });

    const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const idx = Math.round(f * (len - 1));
      const label =
        resultado.modo === 'ciclo'
          ? `${Math.round(f * 100)}%`
          : `${resultado.seriesA.t[idx]?.toFixed(0) ?? 0} h`;
      return {
        x: xOf(idx),
        label,
      };
    });

    return {
      yA: rawA,
      yB: rawB,
      minY: minVal,
      maxY: maxVal,
      pathA: buildPath(valsA),
      pathB: buildPath(valsB),
      ticksY: yTicks,
      ticksX: xTicks,
      n: len,
    };
  }, [resultado, canal, usarLog, meta.unidad]);

  const W = 760;
  const H = 260;
  const mL = 68;
  const mR = 20;
  const mT = 18;
  const mB = 34;
  const plotW = W - mL - mR;
  const plotH = H - mT - mB;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const clamped = Math.max(mL, Math.min(W - mR, relX));
    const frac = (clamped - mL) / plotW;
    const idx = Math.round(frac * (n - 1));
    setProbeIdx(Math.max(0, Math.min(n - 1, idx)));
  };

  const probeX =
    probeIdx !== null ? mL + (probeIdx / Math.max(1, n - 1)) * plotW : null;

  const transformVal = (v: number) =>
    usarLog ? Math.log10(Math.max(v, 1e-12)) : v;

  const probeYA =
    probeIdx !== null
      ? mT + plotH - ((transformVal(yA[probeIdx]) - minY) / (maxY - minY)) * plotH
      : null;
  const probeYB =
    probeIdx !== null
      ? mT + plotH - ((transformVal(yB[probeIdx]) - minY) / (maxY - minY)) * plotH
      : null;

  const correlacion = resultado.correlacionTemporal[canal];
  const similitud = resultado.porVariable[canal];

  return (
    <section
      id="series-temporales"
      className="bg-white border border-slate-200 rounded-lg p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Series temporales comparadas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {resultado.modo === 'ciclo'
              ? 'Eje horizontal normalizado al día local completo de cada cuerpo (0–100%)'
              : `Ventana absoluta (${resultado.ventana[0]} h – ${resultado.ventana[1]} h) · ${resultado.n} muestras`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {CANALES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCanal(c.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  canal === c.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
              className={`px-3 py-1.5 text-xs font-mono rounded-md border whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                escalaLog
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
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
            <span className="inline-block w-4 h-0.5 bg-blue-600" aria-hidden="true" />
            <span className="font-medium text-slate-800">{resultado.sitioA}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-4 h-0.5 border-t-2 border-dashed border-amber-600"
              aria-hidden="true"
            />
            <span className="font-medium text-slate-800">{resultado.sitioB}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono tabular-nums text-slate-600">
          <span>
            Similitud Wasserstein:{' '}
            <strong className="text-slate-900">{similitud.toFixed(1)}%</strong>
          </span>
          <span>·</span>
          <span>
            Forma temporal (r):{' '}
            <strong className="text-slate-900">
              {correlacion !== null
                ? `${correlacion >= 0 ? '+' : ''}${correlacion.toFixed(2)}`
                : 'N/A (constante)'}
            </strong>
          </span>
        </div>
      </div>

      {/* Lienzo SVG con sonda interactiva */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setProbeIdx(null)}
          role="img"
          aria-label={`Serie temporal de ${meta.titulo}`}
        >
          {/* Rejilla horizontal */}
          {ticksY.map((tk, idx) => (
            <g key={idx}>
              <line
                x1={mL}
                y1={tk.y}
                x2={W - mR}
                y2={tk.y}
                stroke="#F1F5F9"
                strokeWidth={1}
              />
              <text
                x={mL - 8}
                y={tk.y + 3}
                textAnchor="end"
                className="fill-slate-500 font-mono text-[10px] tabular-nums"
              >
                {tk.label}
              </text>
            </g>
          ))}

          {/* Rejilla vertical y eje X */}
          {ticksX.map((tk, idx) => (
            <g key={idx}>
              <line
                x1={tk.x}
                y1={mT}
                x2={tk.x}
                y2={H - mB}
                stroke="#F1F5F9"
                strokeWidth={1}
              />
              <text
                x={tk.x}
                y={H - 12}
                textAnchor="middle"
                className="fill-slate-500 font-mono text-[10px] tabular-nums"
              >
                {tk.label}
              </text>
            </g>
          ))}

          {/* Marco de ejes */}
          <rect
            x={mL}
            y={mT}
            width={plotW}
            height={plotH}
            fill="none"
            stroke="#CBD5E1"
            strokeWidth={1}
          />

          {/* Curvas */}
          <path
            d={pathA}
            fill="none"
            stroke="#2563EB"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <path
            d={pathB}
            fill="none"
            stroke="#D97706"
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeLinejoin="round"
          />

          {/* Sonda interactiva */}
          {probeIdx !== null && probeX !== null && probeYA !== null && probeYB !== null && (
            <g>
              <line
                x1={probeX}
                y1={mT}
                x2={probeX}
                y2={H - mB}
                stroke="#64748B"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle cx={probeX} cy={probeYA} r={4} fill="#2563EB" stroke="#fff" strokeWidth={1.5} />
              <circle cx={probeX} cy={probeYB} r={4} fill="#D97706" stroke="#fff" strokeWidth={1.5} />
            </g>
          )}
        </svg>

        {/* HUD numérico de la sonda */}
        <div className="mt-2 min-h-[28px] px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono tabular-nums flex flex-wrap items-center justify-between gap-3 text-slate-700">
          {probeIdx !== null ? (
            <>
              <span>
                {resultado.modo === 'ciclo'
                  ? `Ciclo: ${((probeIdx / Math.max(1, n - 1)) * 100).toFixed(1)}% (A: ${resultado.seriesA.t[probeIdx].toFixed(1)} h · B: ${resultado.seriesB.t[probeIdx].toFixed(1)} h)`
                  : `t = ${resultado.seriesA.t[probeIdx].toFixed(2)} h`}
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-blue-700">
                  A: {formatoCientifico(yA[probeIdx], meta.unidad)} {meta.unidad}
                </span>
                <span className="text-amber-700">
                  B: {formatoCientifico(yB[probeIdx], meta.unidad)} {meta.unidad}
                </span>
              </div>
            </>
          ) : (
            <span className="text-slate-400">
              Desliza el cursor sobre la gráfica para inspeccionar coordenadas exactas (t, y)
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
