import React, { useEffect, useState } from 'react';
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

  // Formulario de carga manual (equivalente a /cargar de app.py)
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
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Cabecera de control del entrenamiento */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Modelos ML: Ensambles de Clima y Similitud (ml.py + db.py + ciclo.py)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dos ensambles independientes de 3 MLP (24 ocultas tanh, Adam MSE
            ponderado) con tope autónomo del 40% e incertidumbre por desacuerdo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setIncluirNasaCiclo(false)}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                !incluirNasaCiclo
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Solo local (offline)
            </button>
            <button
              type="button"
              onClick={() => setIncluirNasaCiclo(true)}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                incluirNasaCiclo
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Local + NASA POWER
            </button>
          </div>

          <select
            value={epocasTrain}
            onChange={(e) => setEpocasTrain(Number(e.target.value))}
            aria-label="Épocas de entrenamiento"
            className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded text-slate-800"
          >
            <option value={800}>800 épocas</option>
            <option value={1200}>1200 épocas</option>
            <option value={2000}>2000 épocas</option>
          </select>

          <button
            type="button"
            onClick={handleEntrenar}
            disabled={entrenando}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
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
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-slate-50/60 border-b border-slate-200 px-5 py-3.5">
        <div className="pb-3 md:pb-0 md:pr-5">
          <div className="text-[11px] font-medium text-slate-500">
            Ensamble Clima (3 MLP · Adam · {status?.modelos.clima?.epocas ?? epocasTrain} ép)
          </div>
          <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
            <span className="text-sm font-semibold text-slate-900">
              {status?.modelos.clima
                ? `MSE ${status.modelos.clima.perdidaMedia.toFixed(4)}`
                : 'Sin entrenar'}
            </span>
            <span className="text-xs text-slate-500">
              {status?.modelos.clima
                ? `${status.modelos.clima.nEditor} ed · ${status.modelos.clima.nAutonomo} aut`
                : '—'}
            </span>
          </div>
        </div>

        <div className="py-3 md:py-0 md:px-5">
          <div className="text-[11px] font-medium text-slate-500">
            Ensamble Similitud (3 MLP · Adam · {status?.modelos.similitud?.epocas ?? epocasTrain} ép)
          </div>
          <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
            <span className="text-sm font-semibold text-slate-900">
              {status?.modelos.similitud
                ? `MSE ${status.modelos.similitud.perdidaMedia.toFixed(4)}`
                : 'Sin entrenar'}
            </span>
            <span className="text-xs text-slate-500">
              {status?.modelos.similitud
                ? `${status.modelos.similitud.nEditor} ed · ${status.modelos.similitud.nAutonomo} aut`
                : '—'}
            </span>
          </div>
        </div>

        <div className="pt-3 md:pt-0 md:pl-5">
          <div className="text-[11px] font-medium text-slate-500">
            Base de conocimiento (conocimiento.db)
          </div>
          <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
            <span className="text-sm font-semibold text-slate-900">
              {status ? `${status.conteos.aprobados} aprobados` : '—'}
            </span>
            <span className="text-xs text-slate-500">
              {status
                ? `${status.conteos.pendientes} pend · ${status.conteos.rechazados} rech`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {mensajeTrain && (
        <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-100 text-xs font-mono text-blue-900">
          {mensajeTrain}
        </div>
      )}

      {/* Pestañas funcionales equivalentes a app.py */}
      <div className="px-5 pt-3 border-b border-slate-200 flex flex-wrap items-center gap-1">
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
            className={`px-3.5 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
              tab === item.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
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
              <div className="text-xs text-amber-700">
                Aún no hay modelos entrenados. Pulsa «Entrenar modelos» para ejecutar el
                ciclo inicial.
              </div>
            ) : pred ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-slate-800">
                      Clima medio predicho en ventana ({pred.t0}–{pred.t1} h)
                    </h3>
                    {prediciendo && (
                      <span className="text-[11px] font-mono text-slate-400">
                        Actualizando...
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-md">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <th className="py-2 px-3">Variable</th>
                          <th className="py-2 px-3 text-right">{pred.a}</th>
                          <th className="py-2 px-3 text-right">{pred.b}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                        {Object.keys(pred.ca).map((k) => (
                          <tr key={k}>
                            <td className="py-2 px-3 font-sans font-medium text-slate-800 capitalize">
                              {k}{' '}
                              <span className="text-[11px] font-mono text-slate-400">
                                ({UNIDADES[k]})
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right text-slate-900">
                              {formatoCientifico(pred.ca[k].valor, UNIDADES[k])}{' '}
                              <span className="text-slate-400">
                                ± {formatoCientifico(pred.ca[k].incertidumbre, UNIDADES[k])}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right text-slate-900">
                              {formatoCientifico(pred.cb[k].valor, UNIDADES[k])}{' '}
                              <span className="text-slate-400">
                                ± {formatoCientifico(pred.cb[k].incertidumbre, UNIDADES[k])}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-800 mb-2">
                    Similitud climática predicha por el ensamble A–B (%)
                  </h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-md">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <th className="py-2 px-3">Dimensión</th>
                          <th className="py-2 px-3 text-right">Predicción ± σ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                        {Object.entries(pred.sim).map(([k, v]) => (
                          <tr
                            key={k}
                            className={k === 'total' ? 'bg-slate-50 font-semibold' : ''}
                          >
                            <td className="py-2 px-3 font-sans font-medium text-slate-800 capitalize">
                              {k === 'total' ? 'TOTAL (climático)' : k}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-900">
                              {v.valor.toFixed(1)}%{' '}
                              <span className="text-slate-400">
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
              <div className="text-xs text-slate-500">Calculando predicciones...</div>
            )}
          </div>
        )}

        {tab === 'revision' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Registros autónomos de fuentes no oficiales quedan en estado{' '}
              <code className="font-mono">pendiente</code> hasta su aprobación manual. Las
              fuentes oficiales (<code className="font-mono">NASA, NOAA, USGS, ESA</code>)
              se aprueban automáticamente.
            </p>
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-3">ID</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Fuente</th>
                    <th className="py-2 px-3 text-right">Conf.</th>
                    <th className="py-2 px-3">x / y</th>
                    <th className="py-2 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {status?.pendientes.length ? (
                    status.pendientes.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 px-3 font-mono tabular-nums">{r.id}</td>
                        <td className="py-2 px-3 font-mono">{r.tipo}</td>
                        <td className="py-2 px-3">{r.fuente}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {r.confianza.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600 max-w-md truncate">
                          {r.x} → {r.y}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleCambiarEstado(r.id, 'aprobado')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded mr-1.5 hover:bg-emerald-100"
                          >
                            <Check className="w-3 h-3" />
                            Aprobar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCambiarEstado(r.id, 'rechazado')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100"
                          >
                            <X className="w-3 h-3" />
                            Rechazar
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-4 px-3 text-slate-500 text-center">
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
                <label className="block text-slate-600 font-medium mb-1">Tipo</label>
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
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                >
                  <option value="clima">clima</option>
                  <option value="similitud">similitud</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Origen</label>
                <select
                  value={formOrigen}
                  onChange={(e) =>
                    setFormOrigen(e.target.value as 'editor' | 'autonomo')
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                >
                  <option value="editor">editor (auto-aprueba)</option>
                  <option value="autonomo">autonomo (pasa a revisión si no oficial)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Fuente</label>
                <input
                  type="text"
                  value={formFuente}
                  onChange={(e) => setFormFuente(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">x (JSON)</label>
              <textarea
                rows={2}
                value={formX}
                onChange={(e) => setFormX(e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">y (JSON)</label>
              <textarea
                rows={2}
                value={formY}
                onChange={(e) => setFormY(e.target.value)}
                className="w-full px-2.5 py-1.5 font-mono border border-slate-300 rounded"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
                Validar y guardar en SQLite
              </button>
              {formMsg && (
                <span className="font-mono text-slate-700">{formMsg}</span>
              )}
            </div>
          </form>
        )}

        {tab === 'historial' && (
          <div className="overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-2 px-3">Fecha</th>
                  <th className="py-2 px-3">Modelo</th>
                  <th className="py-2 px-3 text-right">Editor</th>
                  <th className="py-2 px-3 text-right">Autónomo</th>
                  <th className="py-2 px-3 text-right">% Autónomo</th>
                  <th className="py-2 px-3 text-right">Pérdida (MSE)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {status?.historial.length ? (
                  status.historial.map((h) => {
                    const tot = h.n_editor + h.n_autonomo || 1;
                    const pctAut = (100 * h.n_autonomo) / tot;
                    return (
                      <tr key={h.id}>
                        <td className="py-2 px-3 font-sans text-slate-600">
                          {formatEpoch(h.fecha)}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {h.tipo}
                        </td>
                        <td className="py-2 px-3 text-right">{h.n_editor}</td>
                        <td className="py-2 px-3 text-right">{h.n_autonomo}</td>
                        <td className="py-2 px-3 text-right">{pctAut.toFixed(0)}%</td>
                        <td className="py-2 px-3 text-right">{h.perdida.toFixed(4)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-4 px-3 text-slate-500 text-center">
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
