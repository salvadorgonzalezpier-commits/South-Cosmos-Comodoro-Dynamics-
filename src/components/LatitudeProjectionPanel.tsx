import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  ModoProyeccionLatitud,
  ProyeccionLatitudConfig,
  SitioAmbiental,
} from '../lib/analogo';

export function defaultsProyeccionSitio(sitio: SitioAmbiental): ProyeccionLatitudConfig {
  const esMarte = sitio.id.includes('marte');
  const esLuna = sitio.id.includes('luna');
  return {
    activa: false,
    latDestino: sitio.lat ?? 0,
    modo: 'sinusoidal',
    gradienteLineal: esLuna ? 0.95 : esMarte ? 0.75 : 0.55,
    deltaEpSin: esLuna ? 95 : esMarte ? 65 : 45,
    escalarAmplitud: true,
  };
}

export function calcularProyeccionTemperatura(
  tBase: [number, number],
  latOrigen: number,
  config: ProyeccionLatitudConfig
): {
  tMedia: number;
  tAmp: number;
  deltaMedia: number;
  factorAmplitud: number;
} {
  if (!config.activa) {
    return {
      tMedia: tBase[0],
      tAmp: tBase[1],
      deltaMedia: 0,
      factorAmplitud: 1,
    };
  }

  const phi0 = (latOrigen * Math.PI) / 180;
  const phi1 = (config.latDestino * Math.PI) / 180;

  let tMedia = tBase[0];
  let factorAmplitud = 1;

  if (config.modo === 'lineal') {
    const dAbsLat = Math.abs(config.latDestino) - Math.abs(latOrigen);
    tMedia = Math.max(20, tBase[0] - config.gradienteLineal * dAbsLat);
    if (config.escalarAmplitud) {
      factorAmplitud = Math.max(0.25, Math.min(1.5, 1 - 0.5 * (dAbsLat / 90)));
    }
  } else {
    const cos0 = Math.cos(phi0);
    const cos1 = Math.cos(phi1);
    tMedia = Math.max(20, tBase[0] + config.deltaEpSin * (cos1 - cos0));
    if (config.escalarAmplitud) {
      factorAmplitud = Math.max(
        0.2,
        Math.min(1.8, Math.max(0.15, cos1) / Math.max(0.15, cos0))
      );
    }
  }

  const tAmp = tBase[1] * factorAmplitud;
  return {
    tMedia,
    tAmp,
    deltaMedia: tMedia - tBase[0],
    factorAmplitud,
  };
}

export function aplicarProyeccionASitio(
  sitio: SitioAmbiental,
  config?: ProyeccionLatitudConfig
): SitioAmbiental {
  if (!config || !config.activa) return sitio;
  const latOrigen = sitio.lat ?? 0;
  const res = calcularProyeccionTemperatura(sitio.T, latOrigen, config);
  return {
    ...sitio,
    T: [Number(res.tMedia.toFixed(2)), Number(res.tAmp.toFixed(2))],
    desplazamientoTemp: {
      deltaMedia: res.deltaMedia,
      factorAmplitud: res.factorAmplitud,
      latOrigen,
      latDestino: config.latDestino,
      modo: config.modo,
    },
  };
}

interface LatitudeProjectionPanelProps {
  sitioA: SitioAmbiental;
  sitioB: SitioAmbiental;
  objetivo: 'A' | 'B';
  onChangeObjetivo: (obj: 'A' | 'B') => void;
  config: ProyeccionLatitudConfig;
  onChangeConfig: (next: ProyeccionLatitudConfig) => void;
  onResetSitio: () => void;
}

const LAT_PRESETS = [
  { label: '0° Ecuador', lat: 0 },
  { label: '24° S Atacama', lat: -24.1 },
  { label: '45° N Templado', lat: 45 },
  { label: '75° N Polar', lat: 75 },
];

export const LatitudeProjectionPanel: React.FC<LatitudeProjectionPanelProps> = ({
  sitioA,
  sitioB,
  objetivo,
  onChangeObjetivo,
  config,
  onChangeConfig,
  onResetSitio,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [widthPx, setWidthPx] = useState<number>(640);

  const sitioBase = objetivo === 'A' ? sitioA : sitioB;
  const latOrigen = sitioBase.lat ?? 0;

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

  const proyectado = useMemo(
    () =>
      calcularProyeccionTemperatura(sitioBase.T, latOrigen, {
        ...config,
        activa: true,
      }),
    [sitioBase.T, latOrigen, config]
  );

  const curveData = useMemo(() => {
    const lats = Array.from({ length: 73 }, (_, i) => -90 + i * 2.5);
    const valsLin = lats.map((lat) =>
      calcularProyeccionTemperatura(sitioBase.T, latOrigen, {
        ...config,
        activa: true,
        modo: 'lineal',
        latDestino: lat,
      })
    );
    const valsSin = lats.map((lat) =>
      calcularProyeccionTemperatura(sitioBase.T, latOrigen, {
        ...config,
        activa: true,
        modo: 'sinusoidal',
        latDestino: lat,
      })
    );

    const allVals = [
      ...valsLin.flatMap((v) => [v.tMedia - v.tAmp, v.tMedia + v.tAmp]),
      ...valsSin.flatMap((v) => [v.tMedia - v.tAmp, v.tMedia + v.tAmp]),
    ];

    let lo = Math.min(...allVals);
    let hi = Math.max(...allVals);
    const pad = Math.max(5, (hi - lo) * 0.08);
    lo -= pad;
    hi += pad;

    return { lats, valsLin, valsSin, minY: lo, maxY: hi };
  }, [sitioBase.T, latOrigen, config]);

  const H = 224;
  const mL = 54;
  const mR = 16;
  const mT = 16;
  const mB = 30;
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

    const { lats, valsLin, valsSin, minY, maxY } = curveData;
    const xOf = (lat: number) => mL + ((lat + 90) / 180) * plotW;
    const yOf = (tempK: number) => mT + plotH - ((tempK - minY) / (maxY - minY)) * plotH;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, widthPx, H);

    // Rejilla Y
    ctx.font = '400 10px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const val = minY + f * (maxY - minY);
      const y = yOf(val);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mL, y);
      ctx.lineTo(widthPx - mR, y);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'right';
      ctx.fillText(`${val.toFixed(0)} K`, mL - 8, y);
    }

    // Rejilla X
    ctx.textBaseline = 'alphabetic';
    for (const lat of [-90, -45, 0, 45, 90]) {
      const x = xOf(lat);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.beginPath();
      ctx.moveTo(x, mT);
      ctx.lineTo(x, H - mB);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'center';
      ctx.fillText(`${lat}°`, x, H - 10);
    }

    ctx.strokeStyle = '#1E293B';
    ctx.strokeRect(mL, mT, plotW, plotH);

    // Banda diaria del modelo activo
    const activeSeries = config.modo === 'lineal' ? valsLin : valsSin;
    ctx.beginPath();
    lats.forEach((lat, i) => {
      const x = xOf(lat);
      const y = yOf(activeSeries[i].tMedia + activeSeries[i].tAmp);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    for (let i = lats.length - 1; i >= 0; i--) {
      const x = xOf(lats[i]);
      const y = yOf(Math.max(0, activeSeries[i].tMedia - activeSeries[i].tAmp));
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.fill();

    // Curva de referencia discontinua
    const refSeries = config.modo === 'lineal' ? valsSin : valsLin;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    lats.forEach((lat, i) => {
      const x = xOf(lat);
      const y = yOf(refSeries[i].tMedia);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Curva principal cian
    ctx.beginPath();
    lats.forEach((lat, i) => {
      const x = xOf(lat);
      const y = yOf(activeSeries[i].tMedia);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Latitud origen
    const x0 = xOf(latOrigen);
    const y0 = yOf(sitioBase.T[0]);
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = '#94A3B8';
    ctx.beginPath();
    ctx.moveTo(x0, mT);
    ctx.lineTo(x0, H - mB);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#07090E';
    ctx.beginPath();
    ctx.arc(x0, y0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Latitud destino
    const x1 = xOf(config.latDestino);
    const y1 = yOf(proyectado.tMedia);
    ctx.strokeStyle = config.activa ? '#F59E0B' : '#64748B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, mT);
    ctx.lineTo(x1, H - mB);
    ctx.stroke();

    ctx.fillStyle = config.activa ? '#F59E0B' : '#94A3B8';
    ctx.beginPath();
    ctx.arc(x1, y1, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#07090E';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }, [curveData, widthPx, config, latOrigen, sitioBase.T, proyectado.tMedia, plotW, plotH]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const clampedX = Math.max(mL, Math.min(widthPx - mR, relX));
    const frac = (clampedX - mL) / plotW;
    const newLat = Math.round((frac * 180 - 90) * 2) / 2;
    onChangeConfig({
      ...config,
      activa: true,
      latDestino: newLat,
    });
  };

  const updateConfigAutoActivate = (patch: Partial<ProyeccionLatitudConfig>) => {
    onChangeConfig({
      ...config,
      activa: true,
      ...patch,
    });
  };

  return (
    <section
      id="proyeccion-latitud"
      className="bg-[#0D121D] border border-slate-800 rounded-lg overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Proyección Latitudinal de Temperatura (Canvas)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Simula el traslado de un terreno a otra latitud (modelo lineal o
            sinusoidal) y actualiza el motor de comparación
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onChangeConfig({
                ...config,
                activa: !config.activa,
              })
            }
            className={`px-3 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap shrink-0 transition-colors ${
              config.activa
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-100'
            }`}
          >
            {config.activa ? 'Proyección activa en modelo' : 'Activar proyección'}
          </button>

          <button
            type="button"
            onClick={onResetSitio}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-950 border border-slate-800 rounded-md hover:bg-slate-900 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            Latitud original
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-slate-800">
        {/* Controles de proyección */}
        <div className="xl:col-span-5 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-[11px] font-medium text-slate-400 mb-1">
                Sitio a trasladar
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
                <button
                  type="button"
                  onClick={() => onChangeObjetivo('A')}
                  className={`px-2 py-1 text-xs font-medium rounded truncate ${
                    objetivo === 'A'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sitio A
                </button>
                <button
                  type="button"
                  onClick={() => onChangeObjetivo('B')}
                  className={`px-2 py-1 text-xs font-medium rounded truncate ${
                    objetivo === 'B'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sitio B
                </button>
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-medium text-slate-400 mb-1">
                Tipo de proyección
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
                {(['sinusoidal', 'lineal'] as ModoProyeccionLatitud[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updateConfigAutoActivate({ modo: m })}
                    className={`px-2 py-1 text-xs font-medium rounded capitalize ${
                      config.modo === m
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400 flex items-center justify-between border-t border-slate-800 pt-3">
            <span className="truncate font-medium text-slate-200">{sitioBase.nombre}</span>
            <span className="font-mono tabular-nums text-cyan-300 shrink-0 ml-2">
              φ₀ = {latOrigen.toFixed(1)}°
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="lat-destino-range" className="font-medium text-slate-300">
                Nueva latitud φ₁ (°)
              </label>
              <input
                type="number"
                min={-90}
                max={90}
                step={0.5}
                value={config.latDestino}
                onChange={(e) =>
                  updateConfigAutoActivate({
                    latDestino: Math.max(-90, Math.min(90, Number(e.target.value) || 0)),
                  })
                }
                aria-label="Nueva latitud en grados"
                className="w-20 px-2 py-1 text-right font-mono tabular-nums text-xs bg-slate-950 border border-slate-700 text-slate-100 rounded"
              />
            </div>

            <input
              id="lat-destino-range"
              type="range"
              min={-90}
              max={90}
              step={0.5}
              value={config.latDestino}
              onChange={(e) =>
                updateConfigAutoActivate({ latDestino: Number(e.target.value) })
              }
              className="w-full accent-cyan-400"
            />

            <div className="flex flex-wrap gap-1.5">
              {LAT_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => updateConfigAutoActivate({ latDestino: p.lat })}
                  className="px-2 py-1 text-[11px] font-mono bg-slate-950 border border-slate-800 rounded hover:border-cyan-500/50 text-slate-300 whitespace-nowrap"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-2.5 text-xs">
            {config.modo === 'lineal' ? (
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <label htmlFor="grad-lineal">Gradiente térmico lineal (K / °)</label>
                  <span className="font-mono tabular-nums text-slate-100">
                    {config.gradienteLineal.toFixed(2)} K/°
                  </span>
                </div>
                <input
                  id="grad-lineal"
                  type="range"
                  min={0.1}
                  max={1.5}
                  step={0.05}
                  value={config.gradienteLineal}
                  onChange={(e) =>
                    updateConfigAutoActivate({
                      gradienteLineal: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <label htmlFor="delta-ep-sin">
                    Contraste ecuador–polo ΔT (cos φ)
                  </label>
                  <span className="font-mono tabular-nums text-slate-100">
                    {config.deltaEpSin.toFixed(0)} K
                  </span>
                </div>
                <input
                  id="delta-ep-sin"
                  type="range"
                  min={10}
                  max={160}
                  step={5}
                  value={config.deltaEpSin}
                  onChange={(e) =>
                    updateConfigAutoActivate({ deltaEpSin: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>
            )}

            <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.escalarAmplitud}
                onChange={(e) =>
                  updateConfigAutoActivate({ escalarAmplitud: e.target.checked })
                }
                className="rounded border-slate-700 bg-slate-950 text-cyan-500"
              />
              <span>Escalar amplitud diaria con la latitud</span>
            </label>
          </div>
        </div>

        {/* Gráfica Canvas de perfil latitudinal */}
        <div className="xl:col-span-7 p-5 flex flex-col justify-between space-y-3">
          <div className="grid grid-cols-3 gap-3 pb-3 border-b border-slate-800 font-mono tabular-nums text-xs">
            <div>
              <div className="font-sans text-[11px] text-slate-400">
                T media proyectada
              </div>
              <div className="text-base font-semibold text-slate-100 mt-0.5">
                {proyectado.tMedia.toFixed(1)} K{' '}
                <span className="text-xs font-normal text-slate-400">
                  ({(proyectado.tMedia - 273.15).toFixed(1)} °C)
                </span>
              </div>
            </div>
            <div>
              <div className="font-sans text-[11px] text-slate-400">
                Desplazamiento ΔT
              </div>
              <div
                className={`text-base font-semibold mt-0.5 ${
                  proyectado.deltaMedia >= 0 ? 'text-amber-400' : 'text-cyan-400'
                }`}
              >
                {proyectado.deltaMedia >= 0 ? '+' : ''}
                {proyectado.deltaMedia.toFixed(1)} K
              </div>
            </div>
            <div>
              <div className="font-sans text-[11px] text-slate-400">
                Amplitud diaria A_T
              </div>
              <div className="text-base font-semibold text-slate-100 mt-0.5">
                ±{proyectado.tAmp.toFixed(1)} K{' '}
                <span className="text-xs font-normal text-slate-500">
                  (×{proyectado.factorAmplitud.toFixed(2)})
                </span>
              </div>
            </div>
          </div>

          <div ref={containerRef} className="relative w-full">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              style={{ width: '100%', height: H }}
              className="block rounded-md border border-slate-800 cursor-crosshair select-none"
              aria-label="Perfil latitudinal Canvas de temperatura proyectada"
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5 bg-cyan-400" />
                  Modelo activo ({config.modo}) + banda diaria
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5 border-t border-dashed border-slate-500" />
                  Referencia ({config.modo === 'lineal' ? 'sinusoidal' : 'lineal'})
                </span>
              </div>
              <span className="font-mono text-amber-400">
                Haz clic sobre el Canvas para fijar φ₁
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
