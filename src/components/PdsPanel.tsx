import React, { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import {
  ANALOGOS_LUNA_MARTE_PDS,
  AnalogoPlanetarioPds,
} from '../lib/analogo';
import { PlanetarySatelliteMap } from './PlanetarySatelliteMap';

interface OdeProduct {
  name: string;
  description: string;
  productUrl: string;
  labelUrl: string;
  filesUrl: string;
  utcStart: string | null;
  utcStop: string | null;
  mapScale: string | null;
}

interface PdsBundle {
  id: string;
  lid: string;
  title: string;
  description: string;
  investigation: string;
  nodeName: string;
  startTime: string | null;
  stopTime: string | null;
  pdsUrl: string;
}

interface PdsPanelProps {
  onAplicarSitioPds: (preset: AnalogoPlanetarioPds) => void;
  onActualizarCoordsPds?: (
    cuerpo: 'luna' | 'marte',
    lat: number,
    lon: number
  ) => void;
  sitioLunaNombre: string;
  sitioMarteNombre: string;
}

const INSTRUMENTOS_ODE = {
  luna: [
    { id: 'LRO|DLRE|GDR_L2', etiqueta: 'LRO / Diviner (DLRE GDR_L2)' },
    { id: 'LRO|LOLA|GDRDEM', etiqueta: 'LRO / LOLA (Altimetría GDRDEM)' },
    { id: 'LRO|LROC|CDRWAC4', etiqueta: 'LRO / LROC (Cámara CDRWAC4)' },
  ],
  marte: [
    { id: 'MGS|MOLA|MEGDR', etiqueta: 'MGS / MOLA (Topografía MEGDR)' },
    { id: 'MRO|CRISM|DDR', etiqueta: 'MRO / CRISM (Mineralogía DDR)' },
  ],
};

export const PdsPanel: React.FC<PdsPanelProps> = ({
  onAplicarSitioPds,
  onActualizarCoordsPds,
  sitioLunaNombre,
  sitioMarteNombre,
}) => {
  const [cuerpo, setCuerpo] = useState<'luna' | 'marte'>('luna');
  const presetsCuerpo = ANALOGOS_LUNA_MARTE_PDS.filter((p) => p.cuerpo === cuerpo);
  const [presetActivo, setPresetActivo] = useState<AnalogoPlanetarioPds>(
    ANALOGOS_LUNA_MARTE_PDS[0]
  );
  const [esPersonalizado, setEsPersonalizado] = useState<boolean>(false);

  const [coordLat, setCoordLat] = useState<number>(ANALOGOS_LUNA_MARTE_PDS[0].lat);
  const [coordLon, setCoordLon] = useState<number>(ANALOGOS_LUNA_MARTE_PDS[0].lon);
  const [latInput, setLatInput] = useState<string>(
    ANALOGOS_LUNA_MARTE_PDS[0].lat.toFixed(2)
  );
  const [lonInput, setLonInput] = useState<string>(
    ANALOGOS_LUNA_MARTE_PDS[0].lon.toFixed(2)
  );

  const [instOde, setInstOde] = useState<string>('LRO|DLRE|GDR_L2');
  const [productosOde, setProductosOde] = useState<OdeProduct[]>([]);
  const [cargandoOde, setCargandoOde] = useState(false);
  const [errorOde, setErrorOde] = useState<string | null>(null);

  const [pdsQuery, setPdsQuery] = useState<string>('LRO');
  const [pdsHits, setPdsHits] = useState<number>(0);
  const [bundlesPds, setBundlesPds] = useState<PdsBundle[]>([]);
  const [cargandoPds, setCargandoPds] = useState(false);
  const [errorPds, setErrorPds] = useState<string | null>(null);

  const consultarOde = async (
    targetBody: 'luna' | 'marte',
    combo: string,
    lat: number,
    lon: number
  ) => {
    setCargandoOde(true);
    setErrorOde(null);
    try {
      const [ihid, iid, pt] = combo.split('|');
      const target = targetBody === 'luna' ? 'moon' : 'mars';
      const res = await fetch(
        `/api/pds/ode?target=${target}&ihid=${encodeURIComponent(
          ihid
        )}&iid=${encodeURIComponent(iid)}&pt=${encodeURIComponent(
          pt
        )}&lat=${lat}&lon=${lon}&span=8&limit=5`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error consultando WUSTL ODE');
      setProductosOde(data.products ?? []);
      if (data.warning) setErrorOde(data.warning);
    } catch (err) {
      setErrorOde(err instanceof Error ? err.message : 'Error consultando WUSTL ODE');
    } finally {
      setCargandoOde(false);
    }
  };

  const consultarPds = async (targetBody: 'luna' | 'marte', kw: string) => {
    setCargandoPds(true);
    setErrorPds(null);
    try {
      const target = targetBody === 'luna' ? 'Moon' : 'Mars';
      const res = await fetch(
        `/api/pds/search?target=${target}&keyword=${encodeURIComponent(kw)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error consultando NASA PDS');
      setPdsHits(data.totalHits ?? 0);
      setBundlesPds(data.bundles ?? []);
    } catch (err) {
      setErrorPds(err instanceof Error ? err.message : 'Error consultando NASA PDS');
    } finally {
      setCargandoPds(false);
    }
  };

  useEffect(() => {
    consultarOde('luna', 'LRO|DLRE|GDR_L2', 0.67, 23.47);
    consultarPds('luna', 'LRO');
  }, []);

  useEffect(() => {
    const objetivoNombre = cuerpo === 'luna' ? sitioLunaNombre : sitioMarteNombre;
    const match = ANALOGOS_LUNA_MARTE_PDS.find(
      (p) => p.cuerpo === cuerpo && p.etiquetaSitio === objetivoNombre
    );
    if (match && (match.id !== presetActivo.id || esPersonalizado)) {
      setPresetActivo(match);
      setEsPersonalizado(false);
      setCoordLat(match.lat);
      setCoordLon(match.lon);
      setLatInput(match.lat.toFixed(2));
      setLonInput(match.lon.toFixed(2));
      setPdsQuery(match.queryPds);
      consultarOde(cuerpo, instOde, match.lat, match.lon);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuerpo, sitioLunaNombre, sitioMarteNombre]);

  const handleCambiarCuerpo = (next: 'luna' | 'marte') => {
    setCuerpo(next);
    const objetivoNombre = next === 'luna' ? sitioLunaNombre : sitioMarteNombre;
    const primerPreset =
      ANALOGOS_LUNA_MARTE_PDS.find(
        (p) => p.cuerpo === next && p.etiquetaSitio === objetivoNombre
      ) ?? ANALOGOS_LUNA_MARTE_PDS.find((p) => p.cuerpo === next)!;
    setPresetActivo(primerPreset);
    setEsPersonalizado(false);
    setCoordLat(primerPreset.lat);
    setCoordLon(primerPreset.lon);
    setLatInput(primerPreset.lat.toFixed(2));
    setLonInput(primerPreset.lon.toFixed(2));
    const nextInst = INSTRUMENTOS_ODE[next][0].id;
    setInstOde(nextInst);
    setPdsQuery(primerPreset.queryPds);
    consultarOde(next, nextInst, primerPreset.lat, primerPreset.lon);
    consultarPds(next, primerPreset.queryPds);
  };

  const handleSeleccionarPreset = (p: AnalogoPlanetarioPds) => {
    setPresetActivo(p);
    setEsPersonalizado(false);
    setCoordLat(p.lat);
    setCoordLon(p.lon);
    setLatInput(p.lat.toFixed(2));
    setLonInput(p.lon.toFixed(2));
    setPdsQuery(p.queryPds);
    onAplicarSitioPds(p);
    consultarOde(p.cuerpo, instOde, p.lat, p.lon);
    consultarPds(p.cuerpo, p.queryPds);
  };

  const handleSeleccionarCoordenadas = (nextLat: number, nextLon: number) => {
    const clampedLat = Math.max(-89.9, Math.min(89.9, Number(nextLat.toFixed(3))));
    const normLon = Number(
      (((((nextLon + 180) % 360) + 360) % 360) - 180).toFixed(3)
    );
    setCoordLat(clampedLat);
    setCoordLon(normLon);
    setLatInput(clampedLat.toFixed(2));
    setLonInput(normLon.toFixed(2));
    setEsPersonalizado(true);
    onActualizarCoordsPds?.(cuerpo, clampedLat, normLon);
    consultarOde(cuerpo, instOde, clampedLat, normLon);
  };

  const handleFormCoordenadas = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = Number(latInput);
    const parsedLon = Number(lonInput);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLon)) return;
    handleSeleccionarCoordenadas(parsedLat, parsedLon);
  };

  const trekPortalUrl =
    cuerpo === 'luna'
      ? `https://trek.nasa.gov/moon/#v=0.1&x=${coordLon.toFixed(
          4
        )}&y=${coordLat.toFixed(4)}&z=4&p=urn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A104903`
      : `https://trek.nasa.gov/mars/#v=0.1&x=${coordLon.toFixed(
          4
        )}&y=${coordLat.toFixed(4)}&z=4&p=urn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A104905`;

  return (
    <section
      id="pds-planetario"
      className="bg-[#0D121D] border border-slate-800 rounded-lg overflow-hidden"
    >
      {/* Cabecera PDS Geosciences WUSTL + NASA PDS + Cartografía Planetaria */}
      <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Mapeo satelital de Luna y Marte: NASA PDS, WUSTL & Moon/Mars Trek
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cartografía interactiva (Clementine, Apollo, LRO WAC/LOLA, Viking, MOLA,
            OpenPlanetary), productos ODE (
            <span className="font-mono text-slate-300">pds-geosciences.wustl.edu</span>) y catálogo
            PDS4 (<span className="font-mono text-slate-300">pds.nasa.gov</span>)
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
          <button
            type="button"
            onClick={() => handleCambiarCuerpo('luna')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
              cuerpo === 'luna'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Luna (LRO · Clementine)
          </button>
          <button
            type="button"
            onClick={() => handleCambiarCuerpo('marte')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
              cuerpo === 'marte'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Marte (Viking · MOLA · PDS)
          </button>
        </div>
      </div>

      {/* Selector de ubicaciones calibradas PDS y coordenadas planetarias */}
      <div className="px-5 py-4 bg-[#0B0E17] border-b border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="select-pds-preset"
              className="text-xs font-medium text-slate-400 whitespace-nowrap"
            >
              Sitios calibrados ({cuerpo === 'luna' ? 'Luna' : 'Marte'} ·{' '}
              {presetsCuerpo.length}):
            </label>
            <select
              id="select-pds-preset"
              value={esPersonalizado ? '' : presetActivo.id}
              onChange={(e) => {
                const found = presetsCuerpo.find((p) => p.id === e.target.value);
                if (found) handleSeleccionarPreset(found);
              }}
              className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-700 rounded text-slate-100 font-medium"
            >
              {esPersonalizado && (
                <option value="">Coordenadas personalizadas en mapa</option>
              )}
              {presetsCuerpo.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.lat.toFixed(1)}°, {p.lon.toFixed(1)}°)
                </option>
              ))}
            </select>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            Activo en modelo:{' '}
            <strong className="text-cyan-300">
              {cuerpo === 'luna' ? sitioLunaNombre : sitioMarteNombre}
            </strong>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {presetsCuerpo.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSeleccionarPreset(p)}
              className={`px-2 py-1 text-[11px] font-medium rounded border whitespace-nowrap shrink-0 transition-colors ${
                !esPersonalizado && presetActivo.id === p.id
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              {p.nombre}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
          <form
            onSubmit={handleFormCoordenadas}
            className="flex flex-wrap items-end gap-2"
          >
            <div>
              <label
                htmlFor="pds-lat"
                className="block text-[11px] font-medium text-slate-400 mb-0.5"
              >
                Latitud ({cuerpo === 'luna' ? 'Selenográfica' : 'Aerográfica'})
              </label>
              <input
                id="pds-lat"
                type="number"
                step="0.01"
                min="-89.9"
                max="89.9"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                className="w-28 px-2.5 py-1 text-xs font-mono tabular-nums bg-slate-950 border border-slate-700 text-slate-100 rounded"
              />
            </div>
            <div>
              <label
                htmlFor="pds-lon"
                className="block text-[11px] font-medium text-slate-400 mb-0.5"
              >
                Longitud (°)
              </label>
              <input
                id="pds-lon"
                type="number"
                step="0.01"
                min="-180"
                max="180"
                value={lonInput}
                onChange={(e) => setLonInput(e.target.value)}
                className="w-28 px-2.5 py-1 text-xs font-mono tabular-nums bg-slate-950 border border-slate-700 text-slate-100 rounded"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1 text-xs font-medium text-slate-950 bg-cyan-400 rounded hover:bg-cyan-300 whitespace-nowrap shrink-0"
            >
              Centrar zona
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-300 bg-slate-950 border border-slate-800 rounded px-3 py-1.5">
            <span>
              Zona: ({coordLat.toFixed(2)}°, {coordLon.toFixed(2)}°)
            </span>
            {!esPersonalizado && (
              <>
                <span className="text-slate-600">·</span>
                <span>
                  T: {presetActivo.T[0]} ± {presetActivo.T[1]} K
                </span>
                <span className="text-slate-600">·</span>
                <span>Luz: {presetActivo.luz[0]} W/m²</span>
                <span className="text-slate-600">·</span>
                <span>Pend: {presetActivo.pendiente}°</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Fila principal: Mapa Orbital Interactivo (7 cols) + WUSTL ODE (5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-slate-800">
        <div className="xl:col-span-7 p-5 flex flex-col justify-between space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Visor satelital y cartográfico ({cuerpo === 'luna' ? 'Luna' : 'Marte'})
              </h3>
              <p className="text-[11px] font-mono tabular-nums text-slate-400">
                {esPersonalizado
                  ? `Zona personalizada (${coordLat.toFixed(3)}°, ${coordLon.toFixed(
                      3
                    )}°)`
                  : `${presetActivo.nombre} · ${coordLat.toFixed(
                      2
                    )}°, ${coordLon.toFixed(2)}°`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={trekPortalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:underline whitespace-nowrap shrink-0"
              >
                Abrir en {cuerpo === 'luna' ? 'Moon Trek' : 'Mars Trek'}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href={
                  cuerpo === 'luna'
                    ? 'https://pds-geosciences.wustl.edu/missions/lro/'
                    : 'https://pds.nasa.gov/'
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-cyan-300 hover:underline whitespace-nowrap shrink-0"
              >
                Portal PDS
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <PlanetarySatelliteMap
            cuerpo={cuerpo}
            lat={coordLat}
            lon={coordLon}
            presets={presetsCuerpo}
            activePresetId={esPersonalizado ? null : presetActivo.id}
            onSelectPreset={handleSeleccionarPreset}
            onSelectCoords={handleSeleccionarCoordenadas}
          />
        </div>

        <div className="xl:col-span-5 p-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                WUSTL Geosciences ODE
              </h3>
              <p className="text-[11px] text-slate-400">
                Productos espaciales reales alrededor de ({coordLat.toFixed(2)}°,{' '}
                {coordLon.toFixed(2)}°)
              </p>
            </div>
            <a
              href="https://pds-geosciences.wustl.edu/missions/lro/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:underline whitespace-nowrap shrink-0"
            >
              LRO WUSTL
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={instOde}
              onChange={(e) => {
                const next = e.target.value;
                setInstOde(next);
                consultarOde(cuerpo, next, coordLat, coordLon);
              }}
              aria-label="Instrumento PDS Geosciences ODE"
              className="flex-1 px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-slate-100"
            >
              {INSTRUMENTOS_ODE[cuerpo].map((i) => (
                <option key={i.id} value={i.id}>
                  {i.etiqueta}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => consultarOde(cuerpo, instOde, coordLat, coordLon)}
              disabled={cargandoOde}
              className="p-1.5 bg-slate-950 border border-slate-700 rounded hover:border-cyan-500/50 text-slate-300"
              title="Actualizar consulta ODE"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${cargandoOde ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          {errorOde && <div className="text-[11px] text-amber-400">{errorOde}</div>}

          <div className="flex-1 divide-y divide-slate-800 border border-slate-800 bg-[#07090E] rounded-md overflow-hidden">
            {cargandoOde ? (
              <div className="p-4 text-xs text-slate-400">
                Consultando WUSTL PDS ODE...
              </div>
            ) : productosOde.length === 0 ? (
              <div className="p-4 text-xs text-slate-400">
                Sin productos ODE en esa ventana exacta. Prueba otro instrumento o
                amplía la búsqueda.
              </div>
            ) : (
              productosOde.map((prod) => (
                <div key={prod.name} className="p-3 space-y-1 hover:bg-slate-900/60">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-100 break-all">
                      {prod.name}
                    </span>
                    {prod.labelUrl && (
                      <a
                        href={prod.labelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-medium text-cyan-400 hover:underline whitespace-nowrap shrink-0"
                      >
                        XML
                      </a>
                    )}
                  </div>
                  {prod.description && (
                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {prod.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>
                      {prod.mapScale ? `Escala ${prod.mapScale}` : 'Producto PDS'}
                    </span>
                    {prod.filesUrl && (
                      <a
                        href={prod.filesUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-sans text-cyan-400 hover:underline"
                      >
                        Archivos
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Fila inferior: Catálogo NASA PDS Search (pds.nasa.gov) */}
      <div className="border-t border-slate-800 p-5 space-y-3 bg-[#0B0E17]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Catálogo oficial NASA PDS4 ({cuerpo === 'luna' ? 'Moon' : 'Mars'})
            </h3>
            <p className="text-[11px] text-slate-400">
              Paquetes de datos indexados en <span className="font-mono text-slate-300">pds.nasa.gov</span>
            </p>
          </div>
          <a
            href="https://pds.nasa.gov/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:underline whitespace-nowrap shrink-0"
          >
            pds.nasa.gov
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            consultarPds(cuerpo, pdsQuery);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="relative flex-1 min-w-[220px]">
            <input
              type="text"
              value={pdsQuery}
              onChange={(e) => setPdsQuery(e.target.value)}
              placeholder="Ej. LRO, Diviner, MSL, REMS, InSight, MOLA..."
              aria-label="Filtrar bundles PDS4"
              className="w-full pl-3 pr-7 py-1.5 text-xs bg-slate-950 border border-slate-700 text-slate-100 rounded focus:outline-none focus:border-cyan-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-2" />
          </div>
          <button
            type="submit"
            disabled={cargandoPds}
            className="px-3 py-1.5 text-xs font-medium text-slate-100 bg-slate-950 border border-slate-700 rounded hover:border-cyan-500/50 whitespace-nowrap shrink-0"
          >
            {cargandoPds ? 'Buscando...' : 'Buscar PDS4'}
          </button>
          <span className="text-[11px] font-mono tabular-nums text-slate-400 ml-auto">
            {pdsHits} bundles coincidentes
          </span>
        </form>

        {errorPds && <div className="text-[11px] text-rose-400">{errorPds}</div>}

        {bundlesPds.length === 0 && !cargandoPds ? (
          <div className="p-4 text-xs text-slate-400 bg-[#07090E] border border-slate-800 rounded-md">
            Sin coincidencias para «{pdsQuery}». Prueba limpiar el filtro para ver
            todos los bundles.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {bundlesPds.map((b) => (
              <div
                key={b.id}
                className="p-3 bg-[#07090E] border border-slate-800 rounded-md space-y-1 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={b.pdsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-slate-100 hover:text-cyan-300 line-clamp-1"
                  >
                    {b.title}
                  </a>
                  <a
                    href={b.pdsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-medium text-cyan-400 hover:underline whitespace-nowrap shrink-0"
                  >
                    Ver
                  </a>
                </div>
                <div className="text-[11px] font-mono text-slate-500 truncate">
                  {b.lid}
                </div>
                {b.investigation && (
                  <div className="text-[11px] text-slate-400 truncate">
                    {b.investigation} · {b.nodeName}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
