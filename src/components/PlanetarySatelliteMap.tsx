import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  MapMouseEvent,
  Pin,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair } from 'lucide-react';
import { AnalogoPlanetarioPds } from '../lib/analogo';

export type PlanetaryEngineMode = 'gmaps' | 'trek';

interface PlanetarySatelliteMapProps {
  cuerpo: 'luna' | 'marte';
  lat: number;
  lon: number;
  presets: AnalogoPlanetarioPds[];
  activePresetId: string | null;
  onSelectPreset: (preset: AnalogoPlanetarioPds) => void;
  onSelectCoords: (lat: number, lon: number) => void;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

interface CustomMapLayerDef {
  id: string;
  label: string;
  maxZoom: number;
  buildUrl: (x: number, y: number, zoom: number) => string;
}

const LUNA_GMAPS_LAYERS: CustomMapLayerDef[] = [
  {
    id: 'moon-clem',
    label: 'Clementine · Óptico global',
    maxZoom: 9,
    buildUrl: (x, y, zoom) => {
      const bound = Math.pow(2, zoom);
      return `https://mw1.google.com/mw-planetary/lunar/lunarmaps_v1/clem_bw/${zoom}/${x}/${bound - y - 1}.jpg`;
    },
  },
  {
    id: 'moon-apollo',
    label: 'Apollo · Alta resolución',
    maxZoom: 9,
    buildUrl: (x, y, zoom) => {
      const bound = Math.pow(2, zoom);
      return `https://mw1.google.com/mw-planetary/lunar/lunarmaps_v1/apollo/${zoom}/${x}/${bound - y - 1}.jpg`;
    },
  },
  {
    id: 'moon-terrain',
    label: 'Altimetría · Relieve lunar',
    maxZoom: 9,
    buildUrl: (x, y, zoom) => {
      const bound = Math.pow(2, zoom);
      return `https://mw1.google.com/mw-planetary/lunar/lunarmaps_v1/terrain/${zoom}/${x}/${bound - y - 1}.jpg`;
    },
  },
  {
    id: 'moon-opm',
    label: 'OpenPlanetary · Cráteres IAU',
    maxZoom: 8,
    buildUrl: (x, y, zoom) =>
      `https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-moon-basemap-v0-1/all/${zoom}/${x}/${y}.png`,
  },
];

const MARTE_GMAPS_LAYERS: CustomMapLayerDef[] = [
  {
    id: 'mars-opm',
    label: 'OpenPlanetary · Relieve y Nomenclatura IAU',
    maxZoom: 8,
    buildUrl: (x, y, zoom) =>
      `https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/${zoom}/${x}/${y}.png`,
  },
];

const TREK_LAYERS = {
  luna: [
    {
      id: 'LRO_WAC_Mosaic_Global_303ppd_v02',
      label: 'LRO WAC · Mosaico 303 ppd',
      maxZoom: 7,
    },
    {
      id: 'LRO_LOLA_ClrShade_Global_128ppd_v04',
      label: 'LRO LOLA · Elevación color',
      maxZoom: 5,
    },
  ],
  marte: [
    {
      id: 'Mars_Viking_MDIM21_ClrMosaic_global_232m',
      label: 'Viking MDIM 2.1 · Color 232 m',
      maxZoom: 7,
    },
    {
      id: 'Mars_MGS_MOLA_ClrShade_merge_global_463m',
      label: 'MGS MOLA · Relieve color 463 m',
      maxZoom: 7,
    },
  ],
};

interface TileCoordPoint {
  x: number;
  y: number;
}

interface GoogleMapsRuntime {
  ImageMapType: new (opts: {
    getTileUrl: (coord: TileCoordPoint, zoom: number) => string;
    tileSize: unknown;
    maxZoom: number;
    minZoom: number;
    name: string;
  }) => unknown;
  Size: new (width: number, height: number) => unknown;
}

function getGoogleMapsRuntime(): GoogleMapsRuntime | null {
  const g = (
    window as unknown as { google?: { maps?: Partial<GoogleMapsRuntime> } }
  ).google;
  if (g?.maps?.ImageMapType && g?.maps?.Size) {
    return g.maps as GoogleMapsRuntime;
  }
  return null;
}

type MarkerAnchor = NonNullable<React.ComponentProps<typeof InfoWindow>['anchor']>;

function normalizeTileCoord(
  coord: TileCoordPoint,
  zoom: number
): { x: number; y: number } | null {
  const tileRange = 1 << zoom;
  const y = coord.y;
  if (y < 0 || y >= tileRange) return null;
  let x = coord.x;
  if (x < 0 || x >= tileRange) {
    x = ((x % tileRange) + tileRange) % tileRange;
  }
  return { x, y };
}

function clampMercatorLat(lat: number): number {
  return Math.max(-84.5, Math.min(84.5, lat));
}

function PlanetaryMapController({
  cuerpo,
  layerId,
  lat,
  lon,
  zoom,
}: {
  cuerpo: 'luna' | 'marte';
  layerId: string;
  lat: number;
  lon: number;
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    const gMaps = getGoogleMapsRuntime();
    if (!map || !gMaps) return;

    const defs = cuerpo === 'luna' ? LUNA_GMAPS_LAYERS : MARTE_GMAPS_LAYERS;
    for (const def of defs) {
      if (!map.mapTypes.get(def.id)) {
        const imageMapType = new gMaps.ImageMapType({
          getTileUrl: (coord, z) => {
            const norm = normalizeTileCoord(coord, z);
            if (!norm || z > def.maxZoom) return '';
            return def.buildUrl(norm.x, norm.y, z);
          },
          tileSize: new gMaps.Size(256, 256),
          maxZoom: def.maxZoom,
          minZoom: 1,
          name: def.label,
        });
        map.mapTypes.set(def.id, imageMapType as never);
      }
    }

    const activeDef = defs.find((d) => d.id === layerId) ?? defs[0];
    if (map.getMapTypeId() !== activeDef.id) {
      map.setMapTypeId(activeDef.id);
    }
  }, [map, cuerpo, layerId]);

  useEffect(() => {
    if (!map) return;
    map.panTo({ lat: clampMercatorLat(lat), lng: lon });
  }, [map, lat, lon]);

  useEffect(() => {
    if (!map) return;
    map.setZoom(zoom);
  }, [map, zoom]);

  return null;
}

const GooglePlanetaryCanvas: React.FC<
  PlanetarySatelliteMapProps & {
    gmapsLayerId: string;
    zoom: number;
    onZoomChange: (z: number) => void;
    onSwitchToTrek: () => void;
  }
> = ({
  cuerpo,
  lat,
  lon,
  presets,
  activePresetId,
  gmapsLayerId,
  zoom,
  onZoomChange,
  onSelectPreset,
  onSelectCoords,
  onSwitchToTrek,
}) => {
  const status = useApiLoadingStatus();
  const [selectedPinPreset, setSelectedPinPreset] =
    useState<AnalogoPlanetarioPds | null>(null);
  const markerRefs = useRef<Record<string, MarkerAnchor | null>>({});

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [status]);

  useEffect(() => {
    setSelectedPinPreset(null);
  }, [cuerpo]);

  if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
    return (
      <div className="w-full h-[380px] sm:h-[400px] flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-slate-200 rounded-md border border-slate-200">
        <p className="text-xs font-semibold">
          Error inicializando el mapa interactivo de Google Maps Platform
        </p>
        <p className="text-[11px] text-slate-400 mt-1 mb-3 max-w-md">
          Puedes usar el modo Mosaico NASA Trek (EQ) para continuar inspeccionando
          imágenes orbitales sin interrupción.
        </p>
        <button
          type="button"
          onClick={onSwitchToTrek}
          className="px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded hover:bg-blue-800"
        >
          Cambiar a Mosaico NASA Trek
        </button>
      </div>
    );
  }

  const handleMapClick = (ev: MapMouseEvent) => {
    const pos = ev.detail.latLng;
    if (!pos) return;
    setSelectedPinPreset(null);
    onSelectCoords(Number(pos.lat.toFixed(3)), Number(pos.lng.toFixed(3)));
  };

  const isPolarClamped = Math.abs(lat) > 84.5;

  return (
    <div className="space-y-2">
      {isPolarClamped && (
        <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <span>
            Latitud polar ({lat.toFixed(1)}°): la proyección Web Mercator recorta más allá
            de ±85°.
          </span>
          <button
            type="button"
            onClick={onSwitchToTrek}
            className="font-semibold text-amber-950 underline whitespace-nowrap"
          >
            Ver polo exacto en NASA Trek
          </button>
        </div>
      )}

      <div className="relative w-full h-[380px] sm:h-[400px] bg-[#0b101b] rounded-md overflow-hidden border border-slate-200">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: clampMercatorLat(lat), lng: lon }}
          defaultZoom={zoom}
          backgroundColor="#0b101b"
          gestureHandling="greedy"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={true}
          onClick={handleMapClick}
          onZoomChanged={(ev) => {
            const z = ev.detail.zoom;
            if (Number.isFinite(z)) onZoomChange(Math.round(z));
          }}
          internalUsageAttributionIds={ATTRIBUTION_IDS}
          style={{ width: '100%', height: '100%' }}
        >
          <PlanetaryMapController
            cuerpo={cuerpo}
            layerId={gmapsLayerId}
            lat={lat}
            lon={lon}
            zoom={zoom}
          />

          {presets.map((p) => {
            const isActive = p.id === activePresetId;
            return (
              <AdvancedMarker
                key={p.id}
                ref={(el) => {
                  markerRefs.current[p.id] = el;
                }}
                position={{ lat: clampMercatorLat(p.lat), lng: p.lon }}
                title={p.nombre}
                zIndex={isActive ? 50 : 10}
                onClick={() => {
                  setSelectedPinPreset(p);
                  onSelectPreset(p);
                }}
              >
                <Pin
                  background={isActive ? '#1d4ed8' : '#334155'}
                  borderColor={isActive ? '#ffffff' : '#0f172a'}
                  glyphColor="#ffffff"
                  scale={isActive ? 1.15 : 0.85}
                />
              </AdvancedMarker>
            );
          })}

          {!activePresetId && (
            <AdvancedMarker
              position={{ lat: clampMercatorLat(lat), lng: lon }}
              title="Zona personalizada"
              zIndex={60}
            >
              <Pin
                background="#d97706"
                borderColor="#ffffff"
                glyphColor="#ffffff"
                scale={1.15}
              />
            </AdvancedMarker>
          )}

          {selectedPinPreset && markerRefs.current[selectedPinPreset.id] && (
            <InfoWindow
              anchor={markerRefs.current[selectedPinPreset.id]}
              onCloseClick={() => setSelectedPinPreset(null)}
            >
              <div className="text-xs text-slate-900 space-y-1 max-w-[230px] pr-1">
                <div className="font-semibold leading-snug">
                  {selectedPinPreset.nombre}
                </div>
                <div className="font-mono tabular-nums text-[11px] text-slate-600">
                  {selectedPinPreset.lat.toFixed(2)}°, {selectedPinPreset.lon.toFixed(2)}°
                </div>
                <div className="text-[11px] text-slate-600">
                  {selectedPinPreset.misionFuente}
                </div>
                <div className="font-mono tabular-nums text-[10px] text-slate-500">
                  T: {selectedPinPreset.T[0]}±{selectedPinPreset.T[1]} K · Pend:{' '}
                  {selectedPinPreset.pendiente}°
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  );
};

const NasaTrekMosaicViewer: React.FC<{
  cuerpo: 'luna' | 'marte';
  layerId: string;
  zoom: number;
  lat: number;
  lon: number;
  presets: AnalogoPlanetarioPds[];
  activePresetId: string | null;
  onSelectCoords: (lat: number, lon: number) => void;
  onSelectPreset: (preset: AnalogoPlanetarioPds) => void;
}> = ({
  cuerpo,
  layerId,
  zoom,
  lat,
  lon,
  presets,
  activePresetId,
  onSelectCoords,
  onSelectPreset,
}) => {
  const numCols = Math.pow(2, zoom + 1);
  const numRows = Math.pow(2, zoom);
  const normLon = ((((lon + 180) % 360) + 360) % 360) - 180;
  const clampedLat = Math.max(-89.9, Math.min(89.9, lat));

  const floatCol = ((normLon + 180) / 360) * numCols;
  const floatRow = ((90 - clampedLat) / 180) * numRows;
  const centerCol = Math.floor(floatCol);
  const centerRow = Math.max(0, Math.min(numRows - 1, Math.floor(floatRow)));

  // Posición exacta del objetivo en porcentaje dentro de la grilla 3x3
  const markerLeftPct = ((1 + (floatCol - centerCol)) / 3) * 100;
  const markerTopPct = ((1 + (floatRow - centerRow)) / 3) * 100;

  const tiles = useMemo(() => {
    const items: Array<{ key: string; row: number; col: number; valid: boolean }> = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const r = centerRow + dy;
        const c = ((centerCol + dx) % numCols + numCols) % numCols;
        items.push({
          key: `${layerId}-${zoom}-${r}-${c}-${dx}-${dy}`,
          row: r,
          col: c,
          valid: r >= 0 && r < numRows,
        });
      }
    }
    return items;
  }, [layerId, zoom, centerRow, centerCol, numCols, numRows]);

  const handleMosaicClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    const clickedColFloat = centerCol - 1 + relX * 3;
    const clickedRowFloat = centerRow - 1 + relY * 3;

    let nextLon = (clickedColFloat / numCols) * 360 - 180;
    nextLon = ((((nextLon + 180) % 360) + 360) % 360) - 180;
    const nextLat = Math.max(-89.9, Math.min(89.9, 90 - (clickedRowFloat / numRows) * 180));

    onSelectCoords(Number(nextLat.toFixed(3)), Number(nextLon.toFixed(3)));
  };

  const panStepDeg = Math.max(1.5, 45 / Math.pow(2, zoom));

  return (
    <div className="space-y-2">
      <div
        onClick={handleMosaicClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onSelectCoords(lat, lon - panStepDeg);
          if (e.key === 'ArrowRight') onSelectCoords(lat, lon + panStepDeg);
          if (e.key === 'ArrowUp')
            onSelectCoords(Math.min(89.9, lat + panStepDeg), lon);
          if (e.key === 'ArrowDown')
            onSelectCoords(Math.max(-89.9, lat - panStepDeg), lon);
        }}
        title="Haz clic sobre el mosaico orbital para centrar coordenadas"
        className="relative w-full h-[380px] sm:h-[400px] bg-[#0b101b] rounded-md overflow-hidden border border-slate-200 cursor-crosshair select-none"
      >
        <div className="w-full h-full grid grid-cols-3 grid-rows-3">
          {tiles.map((t) =>
            t.valid ? (
              <img
                key={t.key}
                src={`/api/pds/trek?body=${
                  cuerpo === 'luna' ? 'Moon' : 'Mars'
                }&layer=${encodeURIComponent(layerId)}&z=${zoom}&row=${t.row}&col=${
                  t.col
                }`}
                alt=""
                draggable={false}
                className="w-full h-full object-fill block"
              />
            ) : (
              <div key={t.key} className="w-full h-full bg-[#090d16]" />
            )
          )}
        </div>

        {/* Marcadores de sitios calibrados que caen dentro de la ventana 3x3 */}
        {presets.map((p) => {
          const pNormLon = ((((p.lon + 180) % 360) + 360) % 360) - 180;
          const pColFloat = ((pNormLon + 180) / 360) * numCols;
          const pRowFloat = ((90 - p.lat) / 180) * numRows;
          let dCol = pColFloat - (centerCol - 1);
          if (dCol < -numCols / 2) dCol += numCols;
          if (dCol > numCols / 2) dCol -= numCols;
          const dRow = pRowFloat - (centerRow - 1);
          if (dCol < 0 || dCol > 3 || dRow < 0 || dRow > 3) return null;
          const isSelected = p.id === activePresetId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                onSelectPreset(p);
              }}
              style={{
                left: `${(dCol / 3) * 100}%`,
                top: `${(dRow / 3) * 100}%`,
              }}
              title={`${p.nombre} (${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°)`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-transform hover:scale-125 ${
                isSelected
                  ? 'w-3.5 h-3.5 bg-blue-600 border-white shadow-sm z-20'
                  : 'w-2.5 h-2.5 bg-slate-800/90 border-slate-200 z-10'
              }`}
            />
          );
        })}

        {/* Retícula del punto activo */}
        <div
          style={{ left: `${markerLeftPct}%`, top: `${markerTopPct}%` }}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-30 flex items-center justify-center"
        >
          <Crosshair className="w-6 h-6 text-amber-400 drop-shadow" />
        </div>

        {/* Controles rápidos de paneo N/S/E/O */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2.5 right-2.5 z-30 grid grid-cols-3 gap-0.5 bg-slate-950/75 p-1 rounded border border-white/15"
        >
          <div />
          <button
            type="button"
            onClick={() =>
              onSelectCoords(Number(Math.min(89.9, lat + panStepDeg).toFixed(3)), lon)
            }
            className="p-1 text-slate-200 hover:bg-white/15 rounded"
            title="Mover al Norte"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <div />
          <button
            type="button"
            onClick={() => {
              const nextLon = ((((lon - panStepDeg + 180) % 360) + 360) % 360) - 180;
              onSelectCoords(lat, Number(nextLon.toFixed(3)));
            }}
            className="p-1 text-slate-200 hover:bg-white/15 rounded"
            title="Mover al Oeste"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div className="p-1 text-[9px] font-mono text-slate-400 flex items-center justify-center">
            z{zoom}
          </div>
          <button
            type="button"
            onClick={() => {
              const nextLon = ((((lon + panStepDeg + 180) % 360) + 360) % 360) - 180;
              onSelectCoords(lat, Number(nextLon.toFixed(3)));
            }}
            className="p-1 text-slate-200 hover:bg-white/15 rounded"
            title="Mover al Este"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <div />
          <button
            type="button"
            onClick={() =>
              onSelectCoords(Number(Math.max(-89.9, lat - panStepDeg).toFixed(3)), lon)
            }
            className="p-1 text-slate-200 hover:bg-white/15 rounded"
            title="Mover al Sur"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <div />
        </div>

        <div className="pointer-events-none absolute bottom-2 left-2 right-2 px-2.5 py-1 bg-slate-950/75 text-white text-[11px] font-mono tabular-nums rounded flex items-center justify-between gap-2">
          <span className="truncate">{layerId.replace(/_/g, ' ')}</span>
          <span className="shrink-0">
            NASA Trek EQ · {lat.toFixed(2)}°, {lon.toFixed(2)}°
          </span>
        </div>
      </div>
    </div>
  );
};

export const PlanetarySatelliteMap: React.FC<PlanetarySatelliteMapProps> = (
  props
) => {
  const { cuerpo, lat } = props;
  const [engine, setEngine] = useState<PlanetaryEngineMode>('gmaps');
  const [gmapsLayerId, setGmapsLayerId] = useState<string>('moon-clem');
  const [gmapsZoom, setGmapsZoom] = useState<number>(4);

  const [trekLayerId, setTrekLayerId] = useState<string>(
    'LRO_WAC_Mosaic_Global_303ppd_v02'
  );
  const [trekZoom, setTrekZoom] = useState<number>(3);

  useEffect(() => {
    if (cuerpo === 'luna') {
      setGmapsLayerId(LUNA_GMAPS_LAYERS[0].id);
      setTrekLayerId(TREK_LAYERS.luna[0].id);
    } else {
      setGmapsLayerId(MARTE_GMAPS_LAYERS[0].id);
      setTrekLayerId(TREK_LAYERS.marte[0].id);
    }
    setTrekZoom(3);
  }, [cuerpo]);

  // Si se elige una coordenada polar extrema (ej. Shackleton -89.5°), priorizar Trek EQ sin recorte
  useEffect(() => {
    if (Math.abs(lat) > 84.5) {
      setEngine('trek');
    }
  }, [lat]);

  const activeGmapsLayers =
    cuerpo === 'luna' ? LUNA_GMAPS_LAYERS : MARTE_GMAPS_LAYERS;
  const effectiveGmapsLayerId = activeGmapsLayers.some((l) => l.id === gmapsLayerId)
    ? gmapsLayerId
    : activeGmapsLayers[0].id;

  const activeTrekLayers = TREK_LAYERS[cuerpo];
  const effectiveTrekLayerId = activeTrekLayers.some((l) => l.id === trekLayerId)
    ? trekLayerId
    : activeTrekLayers[0].id;
  const activeTrekMeta =
    activeTrekLayers.find((l) => l.id === effectiveTrekLayerId) ?? activeTrekLayers[0];

  const hasApiKey = Boolean(GOOGLE_MAPS_API_KEY);
  const effectiveEngine: PlanetaryEngineMode =
    engine === 'gmaps' && !hasApiKey ? 'trek' : engine;

  return (
    <div className="space-y-2.5">
      {/* Selector de motor y capa */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
          <button
            type="button"
            disabled={!hasApiKey}
            onClick={() => setEngine('gmaps')}
            className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors disabled:opacity-40 ${
              effectiveEngine === 'gmaps'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mapa Interactivo (Google Maps)
          </button>
          <button
            type="button"
            onClick={() => setEngine('trek')}
            className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
              effectiveEngine === 'trek'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mosaico Orbital NASA Trek
          </button>
        </div>

        {effectiveEngine === 'gmaps' ? (
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded">
            {[
              { z: 2, label: 'Global' },
              { z: 4, label: 'Cuenca' },
              { z: 6, label: 'Cráter' },
              { z: 8, label: 'Detalle' },
            ].map((item) => (
              <button
                key={item.z}
                type="button"
                onClick={() => setGmapsZoom(item.z)}
                className={`px-2 py-1 text-[11px] font-mono rounded whitespace-nowrap shrink-0 ${
                  gmapsZoom === item.z
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded">
            {[1, 2, 3, 4, 5, 6, 7]
              .filter((z) => z <= activeTrekMeta.maxZoom)
              .map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setTrekZoom(z)}
                  className={`px-2 py-1 text-[11px] font-mono rounded whitespace-nowrap shrink-0 ${
                    trekZoom === z
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  z{z}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Selector de capa satelital */}
      <div className="flex flex-wrap items-center gap-1.5">
        {effectiveEngine === 'gmaps'
          ? activeGmapsLayers.map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => setGmapsLayerId(layer.id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded border whitespace-nowrap shrink-0 transition-colors ${
                  effectiveGmapsLayerId === layer.id
                    ? 'bg-blue-50 border-blue-300 text-blue-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {layer.label}
              </button>
            ))
          : activeTrekLayers.map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => {
                  setTrekLayerId(layer.id);
                  if (trekZoom > layer.maxZoom) setTrekZoom(layer.maxZoom);
                }}
                className={`px-2.5 py-1 text-[11px] font-medium rounded border whitespace-nowrap shrink-0 transition-colors ${
                  effectiveTrekLayerId === layer.id
                    ? 'bg-blue-50 border-blue-300 text-blue-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {layer.label}
              </button>
            ))}
      </div>

      {effectiveEngine === 'gmaps' ? (
        <APIProvider
          apiKey={GOOGLE_MAPS_API_KEY}
          libraries={['marker']}
          language="es"
          region="US"
        >
          <GooglePlanetaryCanvas
            {...props}
            gmapsLayerId={effectiveGmapsLayerId}
            zoom={gmapsZoom}
            onZoomChange={setGmapsZoom}
            onSwitchToTrek={() => setEngine('trek')}
          />
        </APIProvider>
      ) : (
        <NasaTrekMosaicViewer
          cuerpo={cuerpo}
          layerId={effectiveTrekLayerId}
          zoom={Math.min(trekZoom, activeTrekMeta.maxZoom)}
          lat={props.lat}
          lon={props.lon}
          presets={props.presets}
          activePresetId={props.activePresetId}
          onSelectCoords={props.onSelectCoords}
          onSelectPreset={props.onSelectPreset}
        />
      )}

      <p className="text-[11px] text-slate-500">
        Haz clic en cualquier marcador de sitio calibrado o sobre la superficie para
        inspeccionar imágenes orbitales y productos WUSTL ODE de esa zona.
      </p>
    </div>
  );
};
