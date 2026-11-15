import React, { useEffect, useRef, useState } from 'react';
import { Check, Play, Plus, X } from 'lucide-react';
import {
  ANALOGOS_LUNA_MARTE_PDS,
  ANALOGOS_TERRESTRES_NASA,
  formatoCientifico,
  ModoComparacion,
  SITIOS_INICIALES,
} from '../lib/analogo';

interface ModeloInfo {
  entrenadoEn: number;
  perdidaMedia: number;
  nEditor: number;
  nAutonomo: number;
  miembros: number;
  epocas?: number;
  duracionMs?: number;
  nIn?: number;
}

interface MlStatus {
  modelosListos: boolean;
  sitiosSoportados?: string[];
  modelos: {
    clima: ModeloInfo | null;
    similitud: ModeloInfo | null;
  };
  conteos: {
    total: number;
    aprobados: number;
    pendientes: number;
    rechazados: number;
    porTipo: {
      clima: { editor: number; autonomo: number; pendientes: number };
      similitud: { editor: number; autonomo: number; pendientes: number };
    };
  };
  historial: Array<{
    id: number;
    fecha: number;
    tipo: 'clima' | 'similitud';
    n_editor: number;
    n_autonomo: number;
    perdida: number;
  }>;
  pendientes: Array<{
    id: number;
    tipo: 'clima' | 'similitud';
    x: string;
    y: string;
    origen: string;
    fuente: string;
    url: string;
    confianza: number;
  }>;
}

interface PrediccionRes {
  a: string;
  b: string;
  t0: number;
  t1: number;
  ca: Record<string, { valor: number; incertidumbre: number }>;
  cb: Record<string, { valor: number; incertidumbre: number }>;
  sim: Record<string, { valor: number; incertidumbre: number }>;
}

interface MlPanelProps {
  sitioANombre: string;
  sitioBNombre: string;
  ventana: [number, number];
  modo: ModoComparacion;
  earthLat: number;
  earthLon: number;
  earthStartDate: string;
  earthEndDate: string;
  refreshSignal?: number;
}

const UNIDADES: Record<string, string> = {
  temperatura: 'K',
  presion: 'Pa',
  viento: 'm/s',
  luz: 'W/m²',
  total: '%',
};

const SITIOS_ML_BASE = Array.from(
  new Set([
    ...SITIOS_INICIALES.map((s) => s.nombre),
    ...ANALOGOS_TERRESTRES_NASA.map((t) => t.etiquetaSitio),
    ...ANALOGOS_LUNA_MARTE_PDS.map((p) => p.etiquetaSitio),
  ])
);

function mapNombreSitioMl(nombre: string, soportados?: string[]): string {
  const limpio = nombre.replace(/\s*\[lat.*?\]$/, '').trim();
  const lista = soportados?.length ? soportados : SITIOS_ML_BASE;
  if (lista.includes(limpio)) return limpio;
  if (limpio.startsWith('Tierra')) return 'Tierra (Atacama, 2400 m)';
  if (limpio.startsWith('Marte')) return 'Marte (Cráter Gale)';
  if (limpio.startsWith('Luna')) return 'Luna (ecuador, mare)';
  return 'Tierra (Atacama, 2400 m)';
}

const MlSimilarityCanvas: React.FC<{
  sim: Record<string, { valor: number; incertidumbre: number }>;
}> = ({ sim }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 560, h: 170 });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r || r.width < 40) return;
      setSize({ w: Math.round(r.width), h: 170 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const entries = Object.entries(sim);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { w, h } = size;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, w, h);

    const padL = 104;
    const padR = 88;
    const padT = 14;
    const padB = 20;
    const plotW = Math.max(40, w - padL - padR);
    const plotH = Math.max(40, h - padT - padB);
    const rowH = plotH / Math.max(1, entries.length);

    // Grilla vertical 0..100%
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    for (const pct of [0, 25, 50, 75, 100]) {
      const x = padL + (pct / 100) * plotW;
      ctx.strokeStyle = pct === 0 || pct === 100 ? '#334155' : 'rgba(30,41,59,0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.fillText(`${pct}%`, x, h - 6);
    }

    entries.forEach(([k, v], idx) => {
      const yMid = padT + (idx + 0.5) * rowH;
      const barH = Math.max(8, Math.min(14, rowH * 0.48));
      const valClamp = Math.max(0, Math.min(100, v.valor));
      const loClamp = Math.max(0, valClamp - v.incertidumbre);
      const hiClamp = Math.min(100, valClamp + v.incertidumbre);
      const valX = padL + (valClamp / 100) * plotW;
      const loX = padL + (loClamp / 100) * plotW;
      const hiX = padL + (hiClamp / 100) * plotW;
      const isTotal = k === 'total';
      const isHover = hoverIdx === idx;

      if (isHover) {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.09)';
        ctx.fillRect(4, padT + idx * rowH, w - 8, rowH);
      }

      // Etiqueta
      ctx.fillStyle = isTotal ? '#F8FAFC' : '#CBD5E1';
      ctx.font = `${isTotal ? '600 ' : ''}11px "IBM Plex Sans", sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(isTotal ? 'TOTAL' : k.toUpperCase(), padL - 10, yMid);

      // Carril base
      ctx.fillStyle = 'rgba(30, 41, 59, 0.75)';
      ctx.fillRect(padL, yMid - barH / 2, plotW, barH);

      // Barra valor
      ctx.fillStyle = isTotal ? '#F59E0B' : '#06B6D4';
      ctx.fillRect(padL, yMid - barH / 2, Math.max(2, valX - padL), barH);

      // Banda de incertidumbre ±σ
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(loX, yMid);
      ctx.lineTo(hiX, yMid);
      ctx.moveTo(loX, yMid - 4);
      ctx.lineTo(loX, yMid + 4);
      ctx.moveTo(hiX, yMid - 4);
      ctx.lineTo(hiX, yMid + 4);
      ctx.stroke();

      // Lectura numérica
      ctx.fillStyle = isHover ? '#67E8F9' : '#E2E8F0';
      ctx.font = '10.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `${v.valor.toFixed(1)}±${v.incertidumbre.toFixed(1)}%`,
        padL + plotW + 8,
        yMid
      );
    });
  }, [entries, hoverIdx, size]);

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || entries.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const padT = 14;
    const plotH = Math.max(40, size.h - padT - 20);
    const idx = Math.floor(((y - padT) / plotH) * entries.length);
    setHoverIdx(idx >= 0 && idx < entries.length ? idx : null);
  };

  return (
    <div ref={wrapRef} className="w-full rounded border border-slate-800 overflow-hidden bg-[#07090E]">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        className="block w-full h-[170px] cursor-crosshair"
        aria-label="Gráfico Canvas de similitud predicha con bandas de incertidumbre"
      />
    </div>
  );
};

export const MlPanel: React.FC<MlPanelProps> = ({
  sitioANombre,
  sitioBNombre,
  ventana,
  modo,
  earthLat,
  earthLon,
  earthStartDate,
  earthEndDate,
  refreshSignal = 0,
}) => {
  const [status, setStatus] = useState<MlStatus | null>(null);
  const [tab, setTab] = useState<'prediccion' | 'revision' | 'cargar' | 'historial'>(
    'prediccion'
  );
  const [entrenando, setEntrenando] = useState(false);
  const [mensajeTrain, setMensajeTrain] = useState<string | null>(null);
  const [pred, setPred] = useState<PrediccionRes | null>(null);
  const [prediciendo, setPrediciendo] = useState(false);
  const [incluirNasaCiclo, setIncluirNasaCiclo] = useState(false);
  const [epocasTrain, setEpocasTrain] = useState<number>(1200);

  // Formulario de carga manual
  const [formTipo, setFormTipo] = useState<'clima' | 'similitud'>('clima');
  const [formOrigen, setFormOrigen] = useState<'editor' | 'autonomo'>('editor');
  const [formFuente, setFormFuente] = useState<string>('editor');
  const [formX, setFormX] = useState<string>(
    '{"sitio": "Marte (Cráter Gale)", "hora": 12}'
  );
  const [formY, setFormY] = useState<string>(
    '{"temperatura": 250, "presion": 740, "viento": 4.2, "luz": 480}'
  );
  const [formMsg, setFormMsg] = useState<string | null>(null);

  const cargarEstado = async () => {
    try {
      const res = await fetch('/api/ml/status');
      if (res.ok) {
        const data = (await res.json()) as MlStatus;
        setStatus(data);
      }
    } catch {
      // Silencio si el servidor aún arranca
    }
  };

  const ejecutarPrediccion = async (
    sA = mapNombreSitioMl(sitioANombre, status?.sitiosSoportados),
    sB = mapNombreSitioMl(sitioBNombre, status?.sitiosSoportados),
    v0 = ventana[0],
    v1 = modo === 'ciclo' ? 48 : ventana[1]
  ) => {
    setPrediciendo(true);
    try {
      const res = await fetch('/api/ml/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sitioA: sA, sitioB: sB, t0: v0, t1: v1 }),
      });
      if (res.ok) {
        setPred((await res.json()) as PrediccionRes);
      }
    } finally {
      setPrediciendo(false);
    }
  };

  useEffect(() => {
    cargarEstado().then(() => {
      ejecutarPrediccion();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (refreshSignal > 0) {
      cargarEstado().then(() => {
        ejecutarPrediccion(
          mapNombreSitioMl(sitioANombre, status?.sitiosSoportados),
          mapNombreSitioMl(sitioBNombre, status?.sitiosSoportados),
          ventana[0],
          modo === 'ciclo' ? 48 : ventana[1]
        );
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  useEffect(() => {
    if (status?.modelosListos) {
      ejecutarPrediccion(
        mapNombreSitioMl(sitioANombre, status?.sitiosSoportados),
        mapNombreSitioMl(sitioBNombre, status?.sitiosSoportados),
        ventana[0],
        modo === 'ciclo' ? 48 : ventana[1]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitioANombre, sitioBNombre, ventana[0], ventana[1], modo, status?.modelosListos]);

  const handleEntrenar = async () => {
    setEntrenando(true);
    setMensajeTrain(null);
    try {
      const res = await fetch('/api/ml/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sembrarSiVacio: true,
          incluirNasa: incluirNasaCiclo,
          epocas: epocasTrain,
          lat: earthLat,
          lon: earthLon,
          start: earthStartDate.replace(/-/g, ''),
          end: earthEndDate.replace(/-/g, ''),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error entrenando ensambles');
      }
      const durSec = ((data.entrenamiento?.duracionMs ?? 0) / 1000).toFixed(1);
      setMensajeTrain(
        `Entrenamiento ${data.modo === 'local' ? '100% local' : 'local + NASA'} (${data.entrenamiento?.epocas ?? epocasTrain} épocas, ${durSec} s): +${data.nuevos} registros · MSE clima=${data.entrenamiento.clima} · MSE similitud=${data.entrenamiento.similitud}`
      );
      await cargarEstado();
      await ejecutarPrediccion(
        mapNombreSitioMl(sitioANombre, data.sitiosSoportados),
        mapNombreSitioMl(sitioBNombre, data.sitiosSoportados),
        ventana[0],
        modo === 'ciclo' ? 48 : ventana[1]
      );
    } catch (err) {
      setMensajeTrain(err instanceof Error ? err.message : 'Error de entrenamiento');
    } finally {
      setEntrenando(false);
    }
  };

  const handleCambiarEstado = async (id: number, estado: 'aprobado' | 'rechazado') => {
    await fetch(`/api/ml/records/${id}/estado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    await cargarEstado();
  };

  const handleGuardarDato = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    try {
      const res = await fetch('/api/ml/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: formTipo,
          x: formX,
          y: formY,
          origen: formOrigen,
          fuente: formFuente,
          confianza: formOrigen === 'editor' ? 1.0 : 0.7,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar registro');
      }
      setFormMsg(`Registro guardado con estado: ${data.estado}`);
      await cargarEstado();
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : 'JSON o rango físico inválido');
    }
  };

  const formatEpoch = (sec: number) => {
    if (!sec) return '—';
    return new Date(sec * 1000).toLocaleString('es-ES', {
      hour12: false,
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <section
      id="modelos-ml"
      className="bg-[#0D121D] border border-slate-800 rounded-lg overflow-hidden text-slate-100"
    >
      {/* Cabecera de control del entrenamiento */}
      <div className="px-5 py-4 border-b border-slate-800 bg-[#0B0E17] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Modelos ML: Ensambles de Clima y Similitud (ml.py + db.py + ciclo.py)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Dos ensambles independientes de 3 MLP (24 ocultas tanh, Adam MSE
            ponderado) con tope autónomo del 40% e incertidumbre por desacuerdo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-0.5 p-0.5 bg-[#07090E] border border-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => setIncluirNasaCiclo(false)}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                !incluirNasaCiclo
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Solo local (offline)
            </button>
            <button
              type="button"
              onClick={() => setIncluirNasaCiclo(true)}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                incluirNasaCiclo
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Local + NASA POWER
            </button>
          </div>

          <select
            value={epocasTrain}
            onChange={(e) => setEpocasTrain(Number(e.target.value))}
            aria-label="Épocas de entrenamiento"
            className="px-2.5 py-1.5 text-xs font-mono bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
          >
            <option value={800}>800 épocas</option>
            <option value={1200}>1200 épocas</option>
            <option value={2000}>2000 épocas</option>
          </select>

          <button
            type="button"
            onClick={handleEntrenar}
            disabled={entrenando}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 rounded-md hover:bg-cyan-300 disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            <Play className="w-3.5 h-3.5" />
            {entrenando
              ? 'Entrenando en local...'
              : incluirNasaCiclo
                ? 'Sincronizar y entrenar'
                : 'Entrenar en local'}
          </button>
        </div>
      </div>

      {/* Métricas de estado de los dos ensambles */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800 bg-[#07090E] border-b border-slate-800 px-5 py-3.5">
        <div className="pb-3 md:pb-0 md:pr-5">
          <div className="text-[11px] font-medium text-slate-400">
            Ensamble Clima (3 MLP · Adam · {status?.modelos.clima?.epocas ?? epocasTrain} ép)
          </div>
          <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
            <span className="text-sm font-semibold text-cyan-300">
              {status?.modelos.clima
                ? `MSE ${status.modelos.clima.perdidaMedia.toFixed(4)}`
                : 'Sin entrenar'}
            </span>
            <span className="text-xs text-slate-400">
              {status?.modelos.clima
                ? `${status.modelos.clima.nEditor} ed · ${status.modelos.clima.nAutonomo} aut`
                : '—'}
            </span>
          </div>
        </div>

        <div className="py-3 md:py-0 md:px-5">
          <div className="text-[11px] font-medium text-slate-400">
            Ensamble Similitud (3 MLP · Adam · {status?.modelos.similitud?.epocas ?? epocasTrain} ép)
          </div>
          <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
            <span className="text-sm font-semibold text-amber-300">
              {status?.modelos.similitud
                ? `MSE ${status.modelos.similitud.perdidaMedia.toFixed(4)}`
                : 'Sin entrenar'}
            </span>
            <span className="text-xs text-slate-400">
              {status?.modelos.similitud
                ? `${status.modelos.similitud.nEditor} ed · ${status.modelos.similitud.nAutonomo} aut`
                : '—'}
            </span>
          </div>
        </div>

        <div className="pt-3 md:pt-0 md:pl-5">
          <div className="text-[11px] font-medium text-slate-400">
            Base de conocimiento (conocimiento.db)
          </div>
          <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
            <span className="text-sm font-semibold text-slate-100">
              {status ? `${status.conteos.aprobados} aprobados` : '—'}
            </span>
            <span className="text-xs text-slate-400">
              {status
                ? `${status.conteos.pendientes} pend · ${status.conteos.rechazados} rech`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {mensajeTrain && (
        <div className="px-5 py-2.5 bg-cyan-950/30 border-b border-cyan-500/30 text-xs font-mono text-cyan-200">
          {mensajeTrain}
        </div>
      )}

      {/* Pestañas funcionales */}
      <div className="px-5 pt-3 border-b border-slate-800 bg-[#0B0E17] flex flex-wrap items-center gap-1">
        {(
          [
            { id: 'prediccion', label: 'Predicciones (± incertidumbre)' },
            {
              id: 'revision',
              label: `Revisión (${status?.conteos.pendientes ?? 0})`,
            },
            { id: 'cargar', label: 'Cargar dato' },
            { id: 'historial', label: 'Historial de entrenamientos' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3.5 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
              tab === item.id
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === 'prediccion' && (
          <div className="space-y-4">
            {!status?.modelosListos ? (
              <div className="text-xs text-amber-300">
                Aún no hay modelos entrenados. Pulsa «Entrenar en local» para ejecutar el
                ciclo inicial.
              </div>
            ) : pred ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-slate-200">
                      Clima medio predicho en ventana ({pred.t0}–{pred.t1} h)
                    </h3>
                    {prediciendo && (
                      <span className="text-[11px] font-mono text-cyan-400">
                        Actualizando...
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto border border-slate-800 rounded-md bg-[#07090E]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#0B0E17] border-b border-slate-800 text-slate-400">
                          <th className="py-2 px-3">Variable</th>
                          <th className="py-2 px-3 text-right text-cyan-300">{pred.a}</th>
                          <th className="py-2 px-3 text-right text-amber-300">{pred.b}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                        {Object.keys(pred.ca).map((k) => (
                          <tr key={k}>
                            <td className="py-2 px-3 font-sans font-medium text-slate-200 capitalize">
                              {k}{' '}
                              <span className="text-[11px] font-mono text-slate-500">
                                ({UNIDADES[k]})
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right text-slate-100">
                              {formatoCientifico(pred.ca[k].valor, UNIDADES[k])}{' '}
                              <span className="text-slate-500">
                                ± {formatoCientifico(pred.ca[k].incertidumbre, UNIDADES[k])}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right text-slate-100">
                              {formatoCientifico(pred.cb[k].valor, UNIDADES[k])}{' '}
                              <span className="text-slate-500">
                                ± {formatoCientifico(pred.cb[k].incertidumbre, UNIDADES[k])}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-200">
                    Similitud climática predicha por el ensamble A–B (%)
                  </h3>
                  <MlSimilarityCanvas sim={pred.sim} />
                  <div className="overflow-x-auto border border-slate-800 rounded-md bg-[#07090E]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#0B0E17] border-b border-slate-800 text-slate-400">
                          <th className="py-2 px-3">Dimensión</th>
                          <th className="py-2 px-3 text-right">Predicción ± σ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                        {Object.entries(pred.sim).map(([k, v]) => (
                          <tr
                            key={k}
                            className={k === 'total' ? 'bg-slate-900/70 font-semibold' : ''}
                          >
                            <td className="py-2 px-3 font-sans font-medium text-slate-200 capitalize">
                              {k === 'total' ? 'TOTAL (climático)' : k}
                            </td>
                            <td
                              className={`py-2 px-3 text-right ${
                                k === 'total' ? 'text-amber-300' : 'text-cyan-300'
                              }`}
                            >
                              {v.valor.toFixed(1)}%{' '}
                              <span className="text-slate-500">
                                ± {v.incertidumbre.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">Calculando predicciones...</div>
            )}
          </div>
        )}

        {tab === 'revision' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Registros autónomos de fuentes no oficiales quedan en estado{' '}
              <code className="font-mono text-cyan-300">pendiente</code> hasta su aprobación manual. Las
              fuentes oficiales (<code className="font-mono text-cyan-300">NASA, NOAA, USGS, ESA</code>)
              se aprueban automáticamente.
            </p>
            <div className="overflow-x-auto border border-slate-800 rounded-md bg-[#07090E]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0B0E17] border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">ID</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Fuente</th>
                    <th className="py-2 px-3 text-right">Conf.</th>
                    <th className="py-2 px-3">x / y</th>
                    <th className="py-2 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {status?.pendientes.length ? (
                    status.pendientes.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-200">{r.id}</td>
                        <td className="py-2 px-3 font-mono text-cyan-300">{r.tipo}</td>
                        <td className="py-2 px-3 text-slate-300">{r.fuente}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-200">
                          {r.confianza.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-400 max-w-md truncate">
                          {r.x} → {r.y}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleCambiarEstado(r.id, 'aprobado')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-500/40 rounded mr-1.5 hover:bg-emerald-900/60"
                          >
                            <Check className="w-3 h-3" />
                            Aprobar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCambiarEstado(r.id, 'rechazado')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-300 bg-rose-950/50 border border-rose-500/40 rounded hover:bg-rose-900/60"
                          >
                            <X className="w-3 h-3" />
                            Rechazar
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-4 px-3 text-slate-400 text-center">
                        No hay registros pendientes de revisión.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'cargar' && (
          <form onSubmit={handleGuardarDato} className="max-w-2xl space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Tipo</label>
                <select
                  value={formTipo}
                  onChange={(e) => {
                    const next = e.target.value as 'clima' | 'similitud';
                    setFormTipo(next);
                    if (next === 'clima') {
                      setFormX('{"sitio": "Marte (Cráter Gale)", "hora": 12}');
                      setFormY(
                        '{"temperatura": 250, "presion": 740, "viento": 4.2, "luz": 480}'
                      );
                    } else {
                      setFormX(
                        '{"a": [290, 75000, 4, 550], "b": [218, 750, 4, 250]}'
                      );
                      setFormY(
                        '{"temperatura": 0, "presion": 33.3, "viento": 98.1, "luz": 73.4, "total": 45.2}'
                      );
                    }
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-700 rounded bg-[#07090E] text-slate-100 focus:outline-none focus:border-cyan-400"
                >
                  <option value="clima">clima</option>
                  <option value="similitud">similitud</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Origen</label>
                <select
                  value={formOrigen}
                  onChange={(e) =>
                    setFormOrigen(e.target.value as 'editor' | 'autonomo')
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-700 rounded bg-[#07090E] text-slate-100 focus:outline-none focus:border-cyan-400"
                >
                  <option value="editor">editor (auto-aprueba)</option>
                  <option value="autonomo">autonomo (pasa a revisión si no oficial)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Fuente</label>
                <input
                  type="text"
                  value={formFuente}
                  onChange={(e) => setFormFuente(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-700 rounded bg-[#07090E] text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">x (JSON)</label>
              <textarea
                rows={2}
                value={formX}
                onChange={(e) => setFormX(e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono border border-slate-700 rounded bg-[#07090E] text-slate-100 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">y (JSON)</label>
              <textarea
                rows={2}
                value={formY}
                onChange={(e) => setFormY(e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono border border-slate-700 rounded bg-[#07090E] text-slate-100 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 rounded hover:bg-cyan-300"
              >
                <Plus className="w-3.5 h-3.5" />
                Validar y guardar en SQLite
              </button>
              {formMsg && (
                <span className="font-mono text-cyan-300">{formMsg}</span>
              )}
            </div>
          </form>
        )}

        {tab === 'historial' && (
          <div className="overflow-x-auto border border-slate-800 rounded-md bg-[#07090E]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0B0E17] border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3">Fecha</th>
                  <th className="py-2 px-3">Modelo</th>
                  <th className="py-2 px-3 text-right">Editor</th>
                  <th className="py-2 px-3 text-right">Autónomo</th>
                  <th className="py-2 px-3 text-right">% Autónomo</th>
                  <th className="py-2 px-3 text-right">Pérdida (MSE)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                {status?.historial.length ? (
                  status.historial.map((h) => {
                    const tot = h.n_editor + h.n_autonomo || 1;
                    const pctAut = (100 * h.n_autonomo) / tot;
                    return (
                      <tr key={h.id}>
                        <td className="py-2 px-3 font-sans text-slate-400">
                          {formatEpoch(h.fecha)}
                        </td>
                        <td className="py-2 px-3 font-semibold text-cyan-300">
                          {h.tipo}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-200">{h.n_editor}</td>
                        <td className="py-2 px-3 text-right text-slate-200">{h.n_autonomo}</td>
                        <td className="py-2 px-3 text-right text-slate-200">{pctAut.toFixed(0)}%</td>
                        <td className="py-2 px-3 text-right text-amber-300">{h.perdida.toFixed(4)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-4 px-3 text-slate-400 text-center">
                      Sin entrenamientos registrados aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
