import React, { useEffect, useState } from 'react';
import { Compass, ExternalLink, MapPin, RefreshCw, Search } from 'lucide-react';
import {
  ANALOGOS_TERRESTRES_NASA,
  SerieMedidaNASA,
} from '../lib/analogo';
import { GoogleSatelliteMap } from './GoogleSatelliteMap';

interface CmrCollection {
  id: string;
  title: string;
  shortName: string;
  versionId: string;
  dataCenter: string;
  summary: string;
  timeStart: string | null;
  timeEnd: string | null;
  earthdataUrl: string;
}

interface MapsGroundingSnippet {
  author: string | null;
  text: string;
  uri: string | null;
}

interface MapsGroundingPlace {
  title: string;
  uri: string;
  placeId: string | null;
  reviewSnippets: MapsGroundingSnippet[];
}

interface MapsGroundingResult {
  respuestaMarkdown: string;
  lugares: MapsGroundingPlace[];
  lat: number | null;
  lon: number | null;
  consulta: string;
  modelo: string;
}

interface EarthdataPanelProps {
  usarNasaEnVivo: boolean;
  onToggleNasaEnVivo: (usar: boolean) => void;
  lat: number;
  lon: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onChangeUbicacion: (
    lat: number,
    lon: number,
    nombreSitio?: string,
    presetMeta?: {
      T?: [number, number];
      P?: [number, number];
      viento?: [number, number];
      luz?: [number, number | null];
      suelo?: Record<string, number>;
      pendiente: number;
      rugosidad: number;
      radiacion: number;
      queryCmr: string;
    }
  ) => void;
  onChangeFechas: (start: string, end: string) => void;
  onSerieCargada: (serie: SerieMedidaNASA) => void;
  serieActual: SerieMedidaNASA | null | undefined;
}

const CAPAS_WORLDVIEW = [
  {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    nombre: 'MODIS Terra · Color real',
  },
  {
    id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    nombre: 'VIIRS Suomi NPP · Color real',
  },
  {
    id: 'MODIS_Terra_Land_Surface_Temp_Day',
    nombre: 'MODIS Terra · Temperatura superficial día',
  },
];

export const EarthdataPanel: React.FC<EarthdataPanelProps> = ({
  usarNasaEnVivo,
  onToggleNasaEnVivo,
  lat,
  lon,
  startDate,
  endDate,
  onChangeUbicacion,
  onChangeFechas,
  onSerieCargada,
  serieActual,
}) => {
  const [presetSeleccionado, setPresetSeleccionado] = useState<string>('atacama-yungay');
  const [latInput, setLatInput] = useState<string>(lat.toFixed(2));
  const [lonInput, setLonInput] = useState<string>(lon.toFixed(2));

  const [cargandoPower, setCargandoPower] = useState<boolean>(false);
  const [errorPower, setErrorPower] = useState<string | null>(null);

  const [visorSatelital, setVisorSatelital] = useState<
    'google-2d' | 'google-3d' | 'worldview'
  >('google-2d');
  const [capaWorldview, setCapaWorldview] = useState<string>(
    'MODIS_Terra_CorrectedReflectance_TrueColor'
  );
  const [spanWorldview, setSpanWorldview] = useState<number>(2.5);
  const [imgError, setImgError] = useState<boolean>(false);

  const [cmrQuery, setCmrQuery] = useState<string>('MERRA-2');
  const [cmrFiltrarPunto, setCmrFiltrarPunto] = useState<boolean>(true);
  const [cmrHits, setCmrHits] = useState<number>(0);
  const [cmrResultados, setCmrResultados] = useState<CmrCollection[]>([]);
  const [cargandoCmr, setCargandoCmr] = useState<boolean>(false);
  const [errorCmr, setErrorCmr] = useState<string | null>(null);

  const [mapsQuery, setMapsQuery] = useState<string>(
    'Estaciones científicas, accesos logísticos, campamentos base y rasgos geológicos cercanos'
  );
  const [mapsLoading, setMapsLoading] = useState<boolean>(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsResult, setMapsResult] = useState<MapsGroundingResult | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  const lastFetchedCoord = React.useRef<string>(`${lat.toFixed(3)},${lon.toFixed(3)}`);

  useEffect(() => {
    setLatInput(lat.toFixed(2));
    setLonInput(lon.toFixed(2));
    const match = ANALOGOS_TERRESTRES_NASA.find(
      (p) => Math.abs(p.lat - lat) < 0.02 && Math.abs(p.lon - lon) < 0.02
    );
    if (match) {
      setPresetSeleccionado(match.id);
      setCmrQuery(match.queryCmr);
    }
    const coordKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (lastFetchedCoord.current !== coordKey) {
      lastFetchedCoord.current = coordKey;
      setImgError(false);
      cargarPower(lat, lon, startDate, endDate);
      if (match) {
        buscarCmr(match.queryCmr, cmrFiltrarPunto, lat, lon);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  const cargarPower = async (
    targetLat: number,
    targetLon: number,
    sDate: string,
    eDate: string
  ) => {
    setCargandoPower(true);
    setErrorPower(null);
    try {
      const start = sDate.replace(/-/g, '');
      const end = eDate.replace(/-/g, '');
      const res = await fetch(
        `/api/earthdata/power?lat=${encodeURIComponent(
          targetLat
        )}&lon=${encodeURIComponent(targetLon)}&start=${start}&end=${end}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al obtener datos de NASA POWER');
      }
      onSerieCargada({
        fuente: data.source,
        lat: data.lat,
        lon: data.lon,
        elevacionM: data.elevacionM,
        start: data.start,
        end: data.end,
        horas: data.horas,
        etiquetas: data.etiquetas,
        temperaturaK: data.temperaturaK,
        presionPa: data.presionPa,
        vientoMs: data.vientoMs,
        luzWm2: data.luzWm2,
      });
    } catch (err) {
      setErrorPower(
        err instanceof Error ? err.message : 'Error consultando NASA Earthdata'
      );
    } finally {
      setCargandoPower(false);
    }
  };

  const buscarCmr = async (
    keyword: string,
    usarPunto: boolean,
    targetLat: number,
    targetLon: number
  ) => {
    setCargandoCmr(true);
    setErrorCmr(null);
    try {
      const params = new URLSearchParams({
        keyword: keyword.trim(),
        page_size: '5',
      });
      if (usarPunto) {
        params.set('lat', String(targetLat));
        params.set('lon', String(targetLon));
      }
      const res = await fetch(`/api/earthdata/cmr?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error consultando NASA CMR');
      }
      setCmrHits(data.totalHits ?? 0);
      setCmrResultados(data.entries ?? []);
    } catch (err) {
      setErrorCmr(
        err instanceof Error ? err.message : 'Error consultando Earthdata Search'
      );
    } finally {
      setCargandoCmr(false);
    }
  };

  // Carga inicial automática de datos reales de NASA Earthdata y catálogo CMR
  useEffect(() => {
    cargarPower(lat, lon, startDate, endDate);
    buscarCmr('MERRA-2', true, lat, lon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSeleccionarPreset = (id: string) => {
    setPresetSeleccionado(id);
    const p = ANALOGOS_TERRESTRES_NASA.find((item) => item.id === id);
    if (!p) return;
    lastFetchedCoord.current = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
    setImgError(false);
    setCmrQuery(p.queryCmr);
    onChangeUbicacion(p.lat, p.lon, p.etiquetaSitio, {
      T: p.T,
      P: p.P,
      viento: p.viento,
      luz: p.luz,
      suelo: p.suelo,
      pendiente: p.pendiente,
      rugosidad: p.rugosidad,
      radiacion: p.radiacion,
      queryCmr: p.queryCmr,
    });
    cargarPower(p.lat, p.lon, startDate, endDate);
    buscarCmr(p.queryCmr, cmrFiltrarPunto, p.lat, p.lon);
  };

  const consultarMaps = async (
    targetLat: number = lat,
    targetLon: number = lon,
    overrideQuery?: string
  ) => {
    const q = (overrideQuery ?? mapsQuery).trim();
    if (!q) {
      setMapsError('Ingresa una consulta geográfica para Google Maps.');
      return;
    }
    setMapsLoading(true);
    setMapsError(null);
    try {
      const res = await fetch('/api/earthdata/maps-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consulta: q,
          lat: targetLat,
          lon: targetLon,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || 'Error al consultar Google Maps Grounding'
        );
      }
      setMapsResult(data as MapsGroundingResult);
    } catch (err) {
      setMapsError(
        err instanceof Error
          ? err.message
          : 'Error consultando Google Maps Grounding'
      );
    } finally {
      setMapsLoading(false);
    }
  };

  const usarMiUbicacionMaps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setMapsError('El navegador no soporta geolocalización.');
      return;
    }
    setGeoStatus('Solicitando coordenadas...');
    setMapsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const myLat = Number(pos.coords.latitude.toFixed(4));
        const myLon = Number(pos.coords.longitude.toFixed(4));
        setGeoStatus(`Ubicación detectada: ${myLat}°, ${myLon}°`);
        setPresetSeleccionado('personalizado');
        setImgError(false);
        onChangeUbicacion(
          myLat,
          myLon,
          `Tierra (${myLat.toFixed(2)}°, ${myLon.toFixed(2)}° · GPS)`
        );
        consultarMaps(myLat, myLon);
      },
      (err) => {
        setGeoStatus(null);
        setMapsError(
          err.message ||
            'No se pudo obtener la ubicación del navegador. Se usarán las coordenadas del panel.'
        );
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleAplicarCoordenadas = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = Math.max(-89.5, Math.min(89.5, Number(latInput) || 0));
    const parsedLon = Math.max(-180, Math.min(180, Number(lonInput) || 0));
    setPresetSeleccionado('personalizado');
    setImgError(false);
    onChangeUbicacion(
      parsedLat,
      parsedLon,
      `Tierra (${parsedLat.toFixed(2)}°, ${parsedLon.toFixed(2)}° · NASA)`
    );
    cargarPower(parsedLat, parsedLon, startDate, endDate);
    if (cmrFiltrarPunto) {
      buscarCmr(cmrQuery, true, parsedLat, parsedLon);
    }
  };

  const worldviewImgUrl = `/api/earthdata/worldview?lat=${encodeURIComponent(
    lat
  )}&lon=${encodeURIComponent(lon)}&span=${spanWorldview}&date=${encodeURIComponent(
    startDate
  )}&layer=${encodeURIComponent(capaWorldview)}`;

  const worldviewDeepLink = `https://worldview.earthdata.nasa.gov/?v=${(
    lon - spanWorldview
  ).toFixed(2)},${(lat - spanWorldview).toFixed(2)},${(lon + spanWorldview).toFixed(
    2
  )},${(lat + spanWorldview).toFixed(2)}&t=${startDate}-T12%3A00%3A00Z`;

  const googleEarthDeepLink = `https://earth.google.com/web/@${lat.toFixed(
    5
  )},${lon.toFixed(5)},1500a,12000d,35y,0h,45t,0r`;

  const earthdataSearchDeepLink = `https://search.earthdata.nasa.gov/search?q=${encodeURIComponent(
    cmrQuery || 'Atacama'
  )}`;

  const sitioPresetActivo = ANALOGOS_TERRESTRES_NASA.find(
    (p) => p.id === presetSeleccionado
  );
  const etiquetaMapaActual =
    sitioPresetActivo?.nombre ?? `Coordenadas (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`;

  return (
    <section
      id="earthdata"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Cabecera de integración NASA Earthdata, Google Earth y Worldview */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Datos terrestres en vivo: NASA Earthdata, Google Earth & Worldview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Observaciones horarias reales (NASA POWER), imágenes satelitales 2D/3D
            de Google Earth / Maps, Worldview GIBS y catálogo CMR
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => onToggleNasaEnVivo(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                usarNasaEnVivo
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              NASA Earthdata en vivo
            </button>
            <button
              type="button"
              onClick={() => onToggleNasaEnVivo(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                !usarNasaEnVivo
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Modelo sintético (analogo.py)
            </button>
          </div>
        </div>
      </div>

      {/* Selector de análogo terrestre, coordenadas y fechas */}
      <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label
              htmlFor="select-tierra-preset"
              className="text-xs font-medium text-slate-600 whitespace-nowrap"
            >
              Análogos terrestres ({ANALOGOS_TERRESTRES_NASA.length}):
            </label>
            <select
              id="select-tierra-preset"
              value={presetSeleccionado === 'personalizado' ? '' : presetSeleccionado}
              onChange={(e) => {
                if (e.target.value) handleSeleccionarPreset(e.target.value);
              }}
              className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded text-slate-800 font-medium"
            >
              {presetSeleccionado === 'personalizado' && (
                <option value="">Coordenadas personalizadas</option>
              )}
              {ANALOGOS_TERRESTRES_NASA.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.lat.toFixed(1)}°, {p.lon.toFixed(1)}°)
                </option>
              ))}
            </select>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Selección rápida o coordenadas manuales
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {ANALOGOS_TERRESTRES_NASA.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSeleccionarPreset(p.id)}
              className={`px-2 py-1 text-[11px] font-medium rounded border whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                presetSeleccionado === p.id
                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {p.nombre}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleAplicarCoordenadas}
          className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end"
        >
          <div>
            <label
              htmlFor="nasa-lat"
              className="block text-[11px] font-medium text-slate-600 mb-1"
            >
              Latitud (°)
            </label>
            <input
              id="nasa-lat"
              type="number"
              step="0.01"
              min="-89.5"
              max="89.5"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded"
            />
          </div>
          <div>
            <label
              htmlFor="nasa-lon"
              className="block text-[11px] font-medium text-slate-600 mb-1"
            >
              Longitud (°)
            </label>
            <input
              id="nasa-lon"
              type="number"
              step="0.01"
              min="-180"
              max="180"
              value={lonInput}
              onChange={(e) => setLonInput(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded"
            />
          </div>
          <div>
            <label
              htmlFor="nasa-start"
              className="block text-[11px] font-medium text-slate-600 mb-1"
            >
              Fecha inicio
            </label>
            <input
              id="nasa-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setImgError(false);
                onChangeFechas(e.target.value, endDate);
              }}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded"
            />
          </div>
          <div>
            <label
              htmlFor="nasa-end"
              className="block text-[11px] font-medium text-slate-600 mb-1"
            >
              Fecha fin
            </label>
            <input
              id="nasa-end"
              type="date"
              value={endDate}
              onChange={(e) => onChangeFechas(startDate, e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded"
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={cargandoPower}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-700 rounded hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${cargandoPower ? 'animate-spin' : ''}`}
              />
              {cargandoPower ? 'Consultando NASA...' : 'Actualizar datos NASA'}
            </button>
            {serieActual && (
              <span className="text-[11px] font-mono tabular-nums text-slate-600 truncate">
                {serieActual.horas.length} h · elev.{' '}
                {serieActual.elevacionM !== null
                  ? `${serieActual.elevacionM.toFixed(0)} m`
                  : 'N/D'}
              </span>
            )}
          </div>
        </form>

        {errorPower && (
          <div className="text-xs text-rose-700 font-medium">
            Error NASA POWER: {errorPower}
          </div>
        )}
      </div>

      {/* Dos columnas: Visor NASA Worldview + Catálogo NASA Earthdata Search */}
      <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-slate-200">
        {/* Visor Satelital Dual: Google Earth / Maps & NASA Worldview */}
        <div className="xl:col-span-6 p-5 flex flex-col justify-between space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {visorSatelital === 'worldview'
                  ? 'Visor satelital NASA Worldview (GIBS)'
                  : visorSatelital === 'google-3d'
                    ? 'Visor orbital Google Earth 3D (Maps JS)'
                    : 'Visor satelital Google Maps / Earth (2D)'}
              </h3>
              <p className="text-[11px] font-mono tabular-nums text-slate-500">
                Centro ({lat.toFixed(4)}°, {lon.toFixed(4)}°)
                {visorSatelital === 'worldview'
                  ? ` · fecha ${startDate} · ±${spanWorldview}°`
                  : ` · ${etiquetaMapaActual}`}
              </p>
            </div>
            <a
              href={
                visorSatelital === 'worldview'
                  ? worldviewDeepLink
                  : googleEarthDeepLink
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
            >
              {visorSatelital === 'worldview'
                ? 'Abrir en Worldview'
                : 'Abrir en Google Earth'}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Selector de motor satelital */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md w-fit">
            <button
              type="button"
              onClick={() => setVisorSatelital('google-2d')}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                visorSatelital === 'google-2d'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Google Satélite
            </button>
            <button
              type="button"
              onClick={() => setVisorSatelital('google-3d')}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                visorSatelital === 'google-3d'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Google Earth 3D
            </button>
            <button
              type="button"
              onClick={() => setVisorSatelital('worldview')}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                visorSatelital === 'worldview'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              NASA Worldview (GIBS)
            </button>
          </div>

          {visorSatelital !== 'worldview' ? (
            <GoogleSatelliteMap
              lat={lat}
              lon={lon}
              siteLabel={etiquetaMapaActual}
              viewMode={visorSatelital === 'google-3d' ? '3d' : '2d'}
              onSelectCoords={(clickedLat, clickedLon) => {
                setPresetSeleccionado('personalizado');
                setImgError(false);
                onChangeUbicacion(
                  clickedLat,
                  clickedLon,
                  `Tierra (${clickedLat.toFixed(2)}°, ${clickedLon.toFixed(2)}° · Satélite)`
                );
              }}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={capaWorldview}
                  onChange={(e) => {
                    setImgError(false);
                    setCapaWorldview(e.target.value);
                  }}
                  aria-label="Capa satelital de NASA Worldview"
                  className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded text-slate-800"
                >
                  {CAPAS_WORLDVIEW.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded">
                  {[1, 2.5, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setImgError(false);
                        setSpanWorldview(s);
                      }}
                      className={`px-2 py-1 text-[11px] font-mono rounded whitespace-nowrap ${
                        spanWorldview === s
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ±{s}°
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative h-[380px] sm:h-[400px] w-full bg-slate-900 rounded-md overflow-hidden border border-slate-200">
                {!imgError ? (
                  <img
                    src={worldviewImgUrl}
                    alt={`Imagen satelital NASA Worldview para ${lat.toFixed(
                      2
                    )}, ${lon.toFixed(2)}`}
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-slate-300">
                    <p className="text-xs font-medium">
                      Capa satelital sin cobertura para la fecha {startDate}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Prueba otra fecha o cambia entre MODIS Terra y VIIRS SNPP.
                    </p>
                  </div>
                )}

                {/* Retícula de coordenadas centrales */}
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <div className="w-6 h-6 border border-white/80 rounded-full flex items-center justify-center">
                    <div className="w-1 h-1 bg-amber-400 rounded-full" />
                  </div>
                </div>

                <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between px-2.5 py-1 bg-slate-950/75 text-white text-[11px] font-mono tabular-nums rounded">
                  <span>{capaWorldview.replace(/_/g, ' ')}</span>
                  <span>
                    {lat.toFixed(2)}°, {lon.toFixed(2)}°
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Explorador de Colecciones NASA Earthdata Search (CMR) */}
        <div className="xl:col-span-6 p-5 flex flex-col space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Catálogo NASA Earthdata Search (CMR)
              </h3>
              <p className="text-[11px] text-slate-500">
                Colecciones satelitales e in-situ indexadas en{' '}
                <span className="font-mono">search.earthdata.nasa.gov</span>
              </p>
            </div>
            <a
              href={earthdataSearchDeepLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
            >
              Abrir en Earthdata Search
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              buscarCmr(cmrQuery, cmrFiltrarPunto, lat, lon);
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <div className="relative flex-1 min-w-[180px]">
              <input
                type="text"
                value={cmrQuery}
                onChange={(e) => setCmrQuery(e.target.value)}
                placeholder="Buscar colección (ej. Atacama, MERRA-2, MODIS)..."
                aria-label="Término de búsqueda en NASA Earthdata"
                className="w-full pl-3 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
            </div>

            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={cmrFiltrarPunto}
                onChange={(e) => {
                  const next = e.target.checked;
                  setCmrFiltrarPunto(next);
                  buscarCmr(cmrQuery, next, lat, lon);
                }}
                className="rounded border-slate-300 text-blue-600"
              />
              Filtrar por punto
            </label>

            <button
              type="submit"
              disabled={cargandoCmr}
              className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200 whitespace-nowrap shrink-0"
            >
              {cargandoCmr ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          {errorCmr && (
            <div className="text-xs text-rose-700">{errorCmr}</div>
          )}

          <div className="text-[11px] font-mono tabular-nums text-slate-500">
            {cmrHits.toLocaleString('es-ES')} colecciones coincidentes en CMR
          </div>

          <div className="flex-1 divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden">
            {cmrResultados.length === 0 && !cargandoCmr ? (
              <div className="p-4 text-xs text-slate-500">
                No se encontraron colecciones con ese filtro. Prueba un término más
                amplio como «MERRA-2» o «MODIS».
              </div>
            ) : (
              cmrResultados.map((item) => (
                <div
                  key={item.id}
                  className="p-3 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <a
                      href={item.earthdataUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-slate-900 hover:text-blue-700 line-clamp-1"
                    >
                      {item.title}
                    </a>
                    <div className="mt-0.5 text-[11px] font-mono text-slate-500 flex flex-wrap items-center gap-1.5">
                      <span>{item.shortName || item.id}</span>
                      {item.versionId && (
                        <>
                          <span>·</span>
                          <span>v{item.versionId}</span>
                        </>
                      )}
                      {item.dataCenter && (
                        <>
                          <span>·</span>
                          <span>{item.dataCenter}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <a
                    href={item.earthdataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0 mt-0.5"
                  >
                    Ver gránulos
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Subpanel: Contexto geográfico en vivo con Google Maps Grounding */}
      <div className="border-t border-slate-200 p-5 bg-slate-50/50 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-700" />
              Contexto geográfico con Google Maps Grounding
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Consulta lugares, accesos logísticos, estaciones científicas y
              reseñas reales ancladas a las coordenadas actuales ({lat.toFixed(2)}°,{' '}
              {lon.toFixed(2)}°).
            </p>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-slate-500">
            Modelo: gemini-4-hydrogen · toolConfig.latLng
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            consultarMaps(lat, lon);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            value={mapsQuery}
            onChange={(e) => setMapsQuery(e.target.value)}
            placeholder="Ej. Estaciones de campo, accesos o puntos de interés geológico cercanos..."
            aria-label="Consulta para Google Maps Grounding"
            className="flex-1 min-w-[240px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
          />
          <button
            type="button"
            onClick={usarMiUbicacionMaps}
            disabled={mapsLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Compass className="w-3.5 h-3.5 text-slate-600" />
            Usar mi ubicación
          </button>
          <button
            type="submit"
            disabled={mapsLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 rounded hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <MapPin className="w-3.5 h-3.5" />
            {mapsLoading ? 'Consultando Maps...' : 'Consultar Google Maps'}
          </button>
        </form>

        {geoStatus && (
          <div className="text-[11px] font-mono tabular-nums text-emerald-700">
            {geoStatus}
          </div>
        )}

        {mapsError && (
          <div className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-md">
            {mapsError}
          </div>
        )}

        {mapsResult && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-xs font-semibold text-slate-800">
                  Síntesis territorial verificada
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-500">
                  {mapsResult.lat !== null && mapsResult.lon !== null
                    ? `${mapsResult.lat.toFixed(2)}°, ${mapsResult.lon.toFixed(2)}°`
                    : 'Sin ancla'}
                </span>
              </div>
              <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {mapsResult.respuestaMarkdown}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-xs font-semibold text-slate-800">
                  Lugares y fuentes de Google Maps ({mapsResult.lugares.length})
                </span>
              </div>

              {mapsResult.lugares.length === 0 ? (
                <p className="text-xs text-slate-500">
                  La consulta no devolvió fichas individuales de Google Maps para
                  este punto remoto; prueba ampliar el radio o consultar el centro
                  poblado más cercano.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {mapsResult.lugares.map((lugar, idx) => (
                    <div
                      key={`${lugar.placeId ?? lugar.uri}-${idx}`}
                      className="py-2.5 first:pt-0 last:pb-0 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={lugar.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center gap-1"
                        >
                          <span>{lugar.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        {lugar.placeId && (
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {lugar.placeId.slice(0, 12)}
                          </span>
                        )}
                      </div>

                      {lugar.reviewSnippets.length > 0 && (
                        <div className="space-y-1 pl-2.5 border-l border-slate-200">
                          {lugar.reviewSnippets.map((snippet, sIdx) => (
                            <div key={sIdx} className="text-[11px] text-slate-600">
                              <p className="line-clamp-3">«{snippet.text}»</p>
                              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                                {snippet.author && <span>— {snippet.author}</span>}
                                {snippet.uri && (
                                  <a
                                    href={snippet.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-700 hover:underline inline-flex items-center gap-0.5"
                                  >
                                    Ver reseña en Google Maps
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
