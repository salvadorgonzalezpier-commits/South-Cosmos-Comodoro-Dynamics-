import React, { Component, useEffect, useMemo, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  AltitudeMode,
  InfoWindow,
  Map as GoogleMap,
  MapMouseEvent,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import { Map3D, MapMode, Marker3D } from '@vis.gl/react-google-maps/3d';

export type GoogleSatelliteViewMode = '2d' | '3d';
export type GoogleBaseMapType = 'satellite' | 'hybrid' | 'terrain';

interface GoogleSatelliteMapProps {
  lat: number;
  lon: number;
  siteLabel: string;
  viewMode: GoogleSatelliteViewMode;
  onSelectCoords?: (lat: number, lon: number) => void;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

function supportsWebGl2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

class Map3DErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function MapCameraSync({
  lat,
  lon,
  zoom,
}: {
  lat: number;
  lon: number;
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo({ lat, lng: lon });
  }, [map, lat, lon]);

  useEffect(() => {
    if (!map) return;
    map.setZoom(zoom);
  }, [map, zoom]);

  return null;
}

const InnerSatelliteViewer: React.FC<GoogleSatelliteMapProps> = ({
  lat,
  lon,
  siteLabel,
  viewMode,
  onSelectCoords,
}) => {
  const status = useApiLoadingStatus();
  const [mapTypeId, setMapTypeId] = useState<GoogleBaseMapType>('satellite');
  const [zoom2d, setZoom2d] = useState<number>(12);
  const [range3d, setRange3d] = useState<number>(4500);
  const [tilt3d, setTilt3d] = useState<number>(58);
  const [heading3d, setHeading3d] = useState<number>(0);
  const [infoOpen, setInfoOpen] = useState<boolean>(false);
  const [map3dFailed, setMap3dFailed] = useState<boolean>(false);
  const [markerRef, marker] = useAdvancedMarkerRef();

  const webGl2Available = useMemo(() => supportsWebGl2(), []);

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [status]);

  useEffect(() => {
    setMap3dFailed(false);
  }, [viewMode, lat, lon]);

  const handleMapClick = (ev: MapMouseEvent) => {
    const pos = ev.detail.latLng;
    if (!pos || !onSelectCoords) return;
    onSelectCoords(Number(pos.lat.toFixed(4)), Number(pos.lng.toFixed(4)));
  };

  if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
    return (
      <div className="w-full h-[380px] sm:h-[400px] flex flex-col items-center justify-center p-6 text-center bg-[#07090E] text-slate-200 rounded-md border border-slate-800">
        <p className="text-xs font-semibold">
          No se pudo inicializar el visor satelital de Google Maps Platform
        </p>
        <p className="text-[11px] text-slate-400 mt-1 max-w-md">
          Verifica la clave VITE_GOOGLE_MAPS_API_KEY o la cuota disponible, o cambia a
          NASA Worldview (GIBS) en el selector superior.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Controles de proyección y escala */}
      {viewMode === '2d' ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded">
            {(
              [
                { id: 'satellite', label: 'Satélite' },
                { id: 'hybrid', label: 'Híbrido' },
                { id: 'terrain', label: 'Relieve' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMapTypeId(opt.id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                  mapTypeId === opt.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded">
            {[
              { z: 9, label: 'Regional' },
              { z: 12, label: 'Sector' },
              { z: 15, label: 'Detalle' },
              { z: 17, label: 'Rover' },
            ].map((preset) => (
              <button
                key={preset.z}
                type="button"
                onClick={() => setZoom2d(preset.z)}
                className={`px-2 py-1 text-[11px] font-mono tabular-nums rounded whitespace-nowrap shrink-0 transition-colors ${
                  zoom2d === preset.z
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded">
            <button
              type="button"
              onClick={() => setMapTypeId('satellite')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded whitespace-nowrap shrink-0 ${
                mapTypeId !== 'hybrid'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              3D Satélite
            </button>
            <button
              type="button"
              onClick={() => setMapTypeId('hybrid')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded whitespace-nowrap shrink-0 ${
                mapTypeId === 'hybrid'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              3D Híbrido
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded">
              {[
                { r: 12000, label: '12 km' },
                { r: 4500, label: '4.5 km' },
                { r: 1200, label: '1.2 km' },
              ].map((item) => (
                <button
                  key={item.r}
                  type="button"
                  onClick={() => setRange3d(item.r)}
                  className={`px-2 py-1 text-[11px] font-mono tabular-nums rounded whitespace-nowrap shrink-0 ${
                    range3d === item.r
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setTilt3d((prev) => (prev > 20 ? 0 : 58))}
              className="px-2 py-1 text-[11px] font-mono tabular-nums bg-slate-950 border border-slate-800 hover:border-cyan-500/40 text-slate-300 rounded whitespace-nowrap shrink-0"
            >
              {tilt3d > 20 ? 'Cenital 0°' : 'Oblicua 58°'}
            </button>

            <button
              type="button"
              onClick={() => setHeading3d((prev) => (prev + 45) % 360)}
              className="px-2 py-1 text-[11px] font-mono tabular-nums bg-slate-950 border border-slate-800 hover:border-cyan-500/40 text-slate-300 rounded whitespace-nowrap shrink-0"
            >
              Rumbo {heading3d}°
            </button>
          </div>
        </div>
      )}

      {/* Contenedor explícito con altura fija para evitar colapso 0x0 */}
      <div className="relative w-full h-[380px] sm:h-[400px] bg-[#07090E] rounded-md overflow-hidden border border-slate-800">
        {viewMode === '2d' ? (
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={{ lat, lng: lon }}
            defaultZoom={zoom2d}
            mapTypeId={mapTypeId}
            gestureHandling="greedy"
            mapTypeControl={false}
            streetViewControl={true}
            fullscreenControl={true}
            onClick={handleMapClick}
            onZoomChanged={(ev) => {
              const z = ev.detail.zoom;
              if (Number.isFinite(z)) setZoom2d(Math.round(z));
            }}
            internalUsageAttributionIds={ATTRIBUTION_IDS}
            style={{ width: '100%', height: '100%' }}
          >
            <MapCameraSync lat={lat} lon={lon} zoom={zoom2d} />
            <AdvancedMarker
              ref={markerRef}
              position={{ lat, lng: lon }}
              title={siteLabel}
              onClick={() => setInfoOpen(true)}
            >
              <Pin
                background="#1d4ed8"
                borderColor="#0f172a"
                glyphColor="#ffffff"
              />
            </AdvancedMarker>
            {infoOpen && marker && (
              <InfoWindow
                anchor={marker}
                onCloseClick={() => setInfoOpen(false)}
              >
                <div className="text-xs text-slate-900 space-y-0.5 pr-2">
                  <div className="font-semibold">{siteLabel}</div>
                  <div className="font-mono tabular-nums text-[11px] text-slate-600">
                    {lat.toFixed(4)}°, {lon.toFixed(4)}°
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        ) : !webGl2Available || map3dFailed ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-slate-200">
            <p className="text-xs font-semibold">
              La vista Google Earth 3D requiere aceleración WebGL2 en este navegador
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-md">
              Cambia a Google Satélite (2D) para inspeccionar imágenes aéreas de alta
              resolución sin WebGL2.
            </p>
          </div>
        ) : (
          <Map3DErrorBoundary
            fallback={
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-slate-200">
                <p className="text-xs font-semibold">
                  No se pudo inicializar el motor 3D fotorrealista
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Usa la pestaña Google Satélite (2D) para continuar la inspección.
                </p>
              </div>
            }
          >
            <Map3D
              mode={mapTypeId === 'hybrid' ? MapMode.HYBRID : MapMode.SATELLITE}
              center={{ lat, lng: lon, altitude: 120 }}
              range={range3d}
              tilt={tilt3d}
              heading={heading3d}
              roll={0}
              onError={() => setMap3dFailed(true)}
              internalUsageAttributionIds={ATTRIBUTION_IDS}
              style={{ width: '100%', height: '100%' }}
            >
              <Marker3D
                position={{ lat, lng: lon, altitude: 60 }}
                altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
                extruded
              >
                <Pin
                  background="#1d4ed8"
                  borderColor="#0f172a"
                  glyphColor="#ffffff"
                />
              </Marker3D>
            </Map3D>
          </Map3DErrorBoundary>
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        Haz clic sobre el mapa satelital 2D para reposicionar las coordenadas del
        análogo y sincronizar NASA POWER y Earthdata CMR.
      </p>
    </div>
  );
};

export const GoogleSatelliteMap: React.FC<GoogleSatelliteMapProps> = (props) => {
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="w-full h-[380px] sm:h-[400px] flex flex-col items-center justify-center p-6 text-center bg-[#07090E] text-slate-200 rounded-md border border-slate-800">
        <p className="text-xs font-semibold">
          Clave de Google Maps Platform no disponible en el cliente
        </p>
        <p className="text-[11px] text-slate-400 mt-1 max-w-md">
          Configura VITE_GOOGLE_MAPS_API_KEY en el entorno o utiliza NASA Worldview
          (GIBS) mientras se recarga el servidor.
        </p>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      libraries={['maps3d', 'marker']}
      language="es"
      region="US"
    >
      <InnerSatelliteViewer {...props} />
    </APIProvider>
  );
};
