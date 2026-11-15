import React, { useMemo } from 'react';
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
  const sitioBase = objetivo === 'A' ? sitioA : sitioB;
  const latOrigen = sitioBase.lat ?? 0;

  const proyectado = useMemo(
    () =>
      calcularProyeccionTemperatura(sitioBase.T, latOrigen, {
        ...config,
        activa: true,
      }),
    [sitioBase.T, latOrigen, config]
  );

  // Curva latitudinal completa de -90° a +90° para visualización comparativa
  const { pathLineal, pathSin, areaSin, minY, maxY, xOf, yOf } = useMemo(() => {
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

    const W = 640;
    const H = 210;
    const mL = 52;
    const mR = 16;
    const mT = 16;
    const mB = 30;
    const plotW = W - mL - mR;
    const plotH = H - mT - mB;

    const xFn = (lat: number) => mL + ((lat + 90) / 180) * plotW;
    const yFn = (tempK: number) => mT + plotH - ((tempK - lo) / (hi - lo)) * plotH;

    const pLin = lats
      .map(
        (lat, i) =>
          `${i === 0 ? 'M' : 'L'}${xFn(lat).toFixed(1)},${yFn(valsLin[i].tMedia).toFixed(1)}`
      )
      .join(' ');
    const pSin = lats
      .map(
        (lat, i) =>
          `${i === 0 ? 'M' : 'L'}${xFn(lat).toFixed(1)},${yFn(valsSin[i].tMedia).toFixed(1)}`
      )
      .join(' ');

    const activeSeries = config.modo === 'lineal' ? valsLin : valsSin;
    const topPts = lats.map(
      (lat, i) =>
        `${xFn(lat).toFixed(1)},${yFn(activeSeries[i].tMedia + activeSeries[i].tAmp).toFixed(1)}`
    );
    const botPts = [...lats]
      .reverse()
      .map((lat, idx) => {
        const i = lats.length - 1 - idx;
        return `${xFn(lat).toFixed(1)},${yFn(
          Math.max(0, activeSeries[i].tMedia - activeSeries[i].tAmp)
        ).toFixed(1)}`;
      });
    const band = `M${topPts.join(' L')} L${botPts.join(' L')} Z`;

    return {
      pathLineal: pLin,
      pathSin: pSin,
      areaSin: band,
      minY: lo,
      maxY: hi,
      xOf: xFn,
      yOf: yFn,
    };
  }, [sitioBase.T, latOrigen, config]);

  const W = 640;
  const H = 210;
  const mL = 52;
  const mR = 16;
  const mT = 16;
  const mB = 30;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const clampedX = Math.max(mL, Math.min(W - mR, relX));
    const frac = (clampedX - mL) / (W - mL - mR);
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

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const val = minY + f * (maxY - minY);
    return { y: yOf(val), label: `${val.toFixed(0)} K` };
  });

  const xTicks = [-90, -45, 0, 45, 90];

  return (
    <section
      id="proyeccion-latitud"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Proyección latitudinal de temperatura
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Simula el traslado de un terreno a otra latitud (modelo lineal o
            sinusoidal) y actualiza automáticamente la comparación
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
            className={`px-3 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
              config.activa
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            {config.activa ? 'Proyección activa en modelo' : 'Activar proyección'}
          </button>

          <button
            type="button"
            onClick={onResetSitio}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Latitud original
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-slate-200">
        {/* Controles de proyección */}
        <div className="xl:col-span-5 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-[11px] font-medium text-slate-600 mb-1">
                Sitio a trasladar
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
                <button
                  type="button"
                  onClick={() => onChangeObjetivo('A')}
                  className={`px-2 py-1 text-xs font-medium rounded truncate ${
                    objetivo === 'A'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Sitio A
                </button>
                <button
                  type="button"
                  onClick={() => onChangeObjetivo('B')}
                  className={`px-2 py-1 text-xs font-medium rounded truncate ${
                    objetivo === 'B'
                      ? 'bg-white text-amber-700 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Sitio B
                </button>
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-medium text-slate-600 mb-1">
                Tipo de proyección
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
                {(['sinusoidal', 'lineal'] as ModoProyeccionLatitud[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updateConfigAutoActivate({ modo: m })}
                    className={`px-2 py-1 text-xs font-medium rounded capitalize ${
                      config.modo === m
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-600 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="truncate font-medium text-slate-800">{sitioBase.nombre}</span>
            <span className="font-mono tabular-nums text-slate-500 shrink-0 ml-2">
              φ₀ = {latOrigen.toFixed(1)}°
            </span>
          </div>

          {/* Control deslizante y numérico de latitud destino */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="lat-destino-range" className="font-medium text-slate-700">
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
                className="w-20 px-2 py-1 text-right font-mono tabular-nums text-xs border border-slate-300 rounded"
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
              className="w-full accent-blue-600"
            />

            <div className="flex flex-wrap gap-1.5">
              {LAT_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => updateConfigAutoActivate({ latDestino: p.lat })}
                  className="px-2 py-1 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 text-slate-700 whitespace-nowrap"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Parámetro del modelo elegido */}
          <div className="pt-2 border-t border-slate-100 space-y-2.5 text-xs">
            {config.modo === 'lineal' ? (
              <div>
                <div className="flex items-center justify-between text-slate-600 mb-1">
                  <label htmlFor="grad-lineal">Gradiente térmico lineal (K / °)</label>
                  <span className="font-mono tabular-nums text-slate-900">
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
                  className="w-full accent-blue-600"
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-slate-600 mb-1">
                  <label htmlFor="delta-ep-sin">
                    Contraste ecuador–polo ΔT (cos φ)
                  </label>
                  <span className="font-mono tabular-nums text-slate-900">
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
                  className="w-full accent-blue-600"
                />
              </div>
            )}

            <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.escalarAmplitud}
                onChange={(e) =>
                  updateConfigAutoActivate({ escalarAmplitud: e.target.checked })
                }
                className="rounded border-slate-300 text-blue-600"
              />
              <span>Escalar amplitud diaria con la latitud</span>
            </label>
          </div>
        </div>

        {/* Gráfica de perfil latitudinal y resumen numérico */}
        <div className="xl:col-span-7 p-5 flex flex-col justify-between space-y-3">
          <div className="grid grid-cols-3 gap-3 pb-3 border-b border-slate-100 font-mono tabular-nums text-xs">
            <div>
              <div className="font-sans text-[11px] text-slate-500">
                T media proyectada
              </div>
              <div className="text-base font-semibold text-slate-900 mt-0.5">
                {proyectado.tMedia.toFixed(1)} K{' '}
                <span className="text-xs font-normal text-slate-500">
                  ({(proyectado.tMedia - 273.15).toFixed(1)} °C)
                </span>
              </div>
            </div>
            <div>
              <div className="font-sans text-[11px] text-slate-500">
                Desplazamiento ΔT
              </div>
              <div
                className={`text-base font-semibold mt-0.5 ${
                  proyectado.deltaMedia >= 0 ? 'text-amber-700' : 'text-blue-700'
                }`}
              >
                {proyectado.deltaMedia >= 0 ? '+' : ''}
                {proyectado.deltaMedia.toFixed(1)} K
              </div>
            </div>
            <div>
              <div className="font-sans text-[11px] text-slate-500">
                Amplitud diaria A_T
              </div>
              <div className="text-base font-semibold text-slate-900 mt-0.5">
                ±{proyectado.tAmp.toFixed(1)} K{' '}
                <span className="text-xs font-normal text-slate-400">
                  (×{proyectado.factorAmplitud.toFixed(2)})
                </span>
              </div>
            </div>
          </div>

          <div className="relative">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              onClick={handleSvgClick}
              className="w-full h-auto cursor-crosshair select-none"
              role="img"
              aria-label="Perfil latitudinal de temperatura proyectada"
            >
              {yTicks.map((tk, idx) => (
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
                    x={mL - 6}
                    y={tk.y + 3}
                    textAnchor="end"
                    className="fill-slate-500 font-mono text-[10px] tabular-nums"
                  >
                    {tk.label}
                  </text>
                </g>
              ))}

              {xTicks.map((lat) => (
                <g key={lat}>
                  <line
                    x1={xOf(lat)}
                    y1={mT}
                    x2={xOf(lat)}
                    y2={H - mB}
                    stroke="#F1F5F9"
                    strokeWidth={1}
                  />
                  <text
                    x={xOf(lat)}
                    y={H - 10}
                    textAnchor="middle"
                    className="fill-slate-500 font-mono text-[10px] tabular-nums"
                  >
                    {lat}°
                  </text>
                </g>
              ))}

              <rect
                x={mL}
                y={mT}
                width={W - mL - mR}
                height={H - mT - mB}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth={1}
              />

              {/* Banda de amplitud diaria del modelo activo */}
              <path d={areaSin} fill="rgba(37, 99, 235, 0.10)" />

              {/* Curva secundaria de referencia */}
              <path
                d={config.modo === 'lineal' ? pathSin : pathLineal}
                fill="none"
                stroke="#94A3B8"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />

              {/* Curva activa */}
              <path
                d={config.modo === 'lineal' ? pathLineal : pathSin}
                fill="none"
                stroke="#2563EB"
                strokeWidth={2}
              />

              {/* Marcador de latitud origen φ0 */}
              <line
                x1={xOf(latOrigen)}
                y1={mT}
                x2={xOf(latOrigen)}
                y2={H - mB}
                stroke="#64748B"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <circle
                cx={xOf(latOrigen)}
                cy={yOf(sitioBase.T[0])}
                r={4}
                fill="#FFFFFF"
                stroke="#475569"
                strokeWidth={1.5}
              />

              {/* Marcador de latitud destino φ1 */}
              <line
                x1={xOf(config.latDestino)}
                y1={mT}
                x2={xOf(config.latDestino)}
                y2={H - mB}
                stroke={config.activa ? '#2563EB' : '#94A3B8'}
                strokeWidth={1.5}
              />
              <circle
                cx={xOf(config.latDestino)}
                cy={yOf(proyectado.tMedia)}
                r={5}
                fill={config.activa ? '#2563EB' : '#94A3B8'}
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
            </svg>

            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5 bg-blue-600" />
                  Modelo activo ({config.modo}) + banda diaria
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5 border-t border-dashed border-slate-400" />
                  Referencia ({config.modo === 'lineal' ? 'sinusoidal' : 'lineal'})
                </span>
              </div>
              <span className="font-mono">Haz clic en el gráfico para fijar φ₁</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
