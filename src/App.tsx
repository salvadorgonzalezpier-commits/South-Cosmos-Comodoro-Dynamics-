import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Menu,
  RotateCcw,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  ANALOGOS_LUNA_MARTE_PDS,
  ANALOGOS_TERRESTRES_NASA,
  AnalogoPlanetarioPds,
  AnalogoTerrestrePreset,
  compararSitios,
  CRITICAS_DEFAULT,
  ESCALAS_DEFAULT,
  formatoCientifico,
  METADATOS_VARIABLES,
  ModoComparacion,
  ORDEN_VARIABLES,
  PESOS_DEFAULT,
  ProyeccionLatitudConfig,
  SerieMedidaNASA,
  SITIOS_INICIALES,
  SitioAmbiental,
  VariableAnalogo,
  VariableContinua,
} from './lib/analogo';
import { LabTelemetryBridge } from './lib/wearEngine';
import { RadarChart } from './components/RadarChart';
import { TimeSeriesPanel } from './components/TimeSeriesPanel';
import { CompositionPanel } from './components/CompositionPanel';
import { ConsoleOutput } from './components/ConsoleOutput';
import { EarthdataPanel } from './components/EarthdataPanel';
import { MlPanel } from './components/MlPanel';
import { PdsPanel } from './components/PdsPanel';
import { WhitelistVerifyPanel } from './components/WhitelistVerifyPanel';
import { CanvasEngineWorkspace } from './components/CanvasEngineWorkspace';
import { HomePortal } from './components/HomePortal';
import { WearTestStudio } from './components/WearTestStudio';
import {
  aplicarProyeccionASitio,
  defaultsProyeccionSitio,
  LatitudeProjectionPanel,
} from './components/LatitudeProjectionPanel';

type PresetId = 't-m' | 't-l' | 'm-l' | 'custom';

export function App() {
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState<boolean>(false);

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const [vista, setVista] = useState<
    'inicio' | 'desgaste' | 'canvas' | 'laboratorio'
  >(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('vista') === 'lab') return 'laboratorio';
      if (params.get('vista') === 'canvas') return 'canvas';
      if (params.get('vista') === 'desgaste') return 'desgaste';
    }
    return 'inicio';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [wearTargetPdsId, setWearTargetPdsId] = useState<string>('marte-jezero-2020');
  const [wearHardwareId, setWearHardwareId] = useState<string>('rover-6x6');
  const [sitios, setSitios] = useState<SitioAmbiental[]>(() =>
    structuredClone(SITIOS_INICIALES)
  );
  const [sitioAId, setSitioAId] = useState<string>('tierra-atacama');
  const [sitioBId, setSitioBId] = useState<string>('marte-gale');
  const [modo, setModo] = useState<ModoComparacion>('reloj');
  const [t0, setT0] = useState<number>(0);
  const [t1, setT1] = useState<number>(48);
  const [nMuestras, setNMuestras] = useState<number>(240);
  const [pesos, setPesos] = useState<Record<VariableAnalogo, number>>(() => ({
    ...PESOS_DEFAULT,
  }));
  const [criticas, setCriticas] = useState<VariableAnalogo[]>([...CRITICAS_DEFAULT]);
  const [escalas, setEscalas] = useState<Record<VariableContinua, number>>(() => ({
    ...ESCALAS_DEFAULT,
  }));

  const [abrirPesos, setAbrirPesos] = useState<boolean>(false);
  const [abrirParametros, setAbrirParametros] = useState<boolean>(false);
  const [sitioEditando, setSitioEditando] = useState<'A' | 'B'>('A');
  const [mlRefreshSignal, setMlRefreshSignal] = useState<number>(0);

  // Estado de integración NASA Earthdata + Worldview para Tierra
  const [usarNasaEnVivo, setUsarNasaEnVivo] = useState<boolean>(true);
  const [earthLat, setEarthLat] = useState<number>(-24.1);
  const [earthLon, setEarthLon] = useState<number>(-69.9);
  const [earthStartDate, setEarthStartDate] = useState<string>('2026-06-15');
  const [earthEndDate, setEarthEndDate] = useState<string>('2026-06-16');

  // Proyección latitudinal de temperatura (lineal / sinusoidal)
  const [proyecciones, setProyecciones] = useState<
    Record<string, ProyeccionLatitudConfig>
  >({});
  const [proyeccionObjetivo, setProyeccionObjetivo] = useState<'A' | 'B'>('A');

  const sitioTierra = useMemo(
    () => sitios.find((s) => s.id === 'tierra-atacama') ?? sitios[0],
    [sitios]
  );
  const sitioMarte = useMemo(
    () => sitios.find((s) => s.id === 'marte-gale') ?? sitios[1],
    [sitios]
  );
  const sitioLuna = useMemo(
    () => sitios.find((s) => s.id === 'luna-mare') ?? sitios[2],
    [sitios]
  );

  const sitioABase = useMemo(
    () => sitios.find((s) => s.id === sitioAId) ?? sitios[0],
    [sitios, sitioAId]
  );
  const sitioBBase = useMemo(
    () => sitios.find((s) => s.id === sitioBId) ?? sitios[1],
    [sitios, sitioBId]
  );

  const sitiosEfectivos = useMemo(
    () => sitios.map((s) => aplicarProyeccionASitio(s, proyecciones[s.id])),
    [sitios, proyecciones]
  );

  const sitioA = useMemo(
    () => sitiosEfectivos.find((s) => s.id === sitioAId) ?? sitiosEfectivos[0],
    [sitiosEfectivos, sitioAId]
  );
  const sitioB = useMemo(
    () => sitiosEfectivos.find((s) => s.id === sitioBId) ?? sitiosEfectivos[1],
    [sitiosEfectivos, sitioBId]
  );

  const sitioObjetivoBase = proyeccionObjetivo === 'A' ? sitioABase : sitioBBase;
  const proyeccionActual = useMemo(
    () =>
      proyecciones[sitioObjetivoBase.id] ??
      defaultsProyeccionSitio(sitioObjetivoBase),
    [proyecciones, sitioObjetivoBase]
  );

  const ventana: [number, number] = useMemo(() => {
    const inicio = Math.min(t0, t1);
    const fin = Math.max(t0 + 1, t1);
    return [inicio, fin];
  }, [t0, t1]);

  const resultado = useMemo(
    () =>
      compararSitios(sitioA, sitioB, {
        horas: ventana,
        modo,
        n: nMuestras,
        pesos,
        criticas,
        escalas,
      }),
    [sitioA, sitioB, ventana, modo, nMuestras, pesos, criticas, escalas]
  );

  const presetActivo: PresetId = useMemo(() => {
    if (
      sitioAId === 'tierra-atacama' &&
      sitioBId === 'marte-gale' &&
      modo === 'reloj' &&
      t0 === 0 &&
      t1 === 48
    ) {
      return 't-m';
    }
    if (
      sitioAId === 'tierra-atacama' &&
      sitioBId === 'luna-mare' &&
      modo === 'reloj' &&
      t0 === 0 &&
      t1 === 48
    ) {
      return 't-l';
    }
    if (
      sitioAId === 'marte-gale' &&
      sitioBId === 'luna-mare' &&
      modo === 'ciclo'
    ) {
      return 'm-l';
    }
    return 'custom';
  }, [sitioAId, sitioBId, modo, t0, t1]);

  const aplicarPreset = (id: 't-m' | 't-l' | 'm-l') => {
    if (id === 't-m') {
      setSitioAId('tierra-atacama');
      setSitioBId('marte-gale');
      setModo('reloj');
      setT0(0);
      setT1(48);
    } else if (id === 't-l') {
      setSitioAId('tierra-atacama');
      setSitioBId('luna-mare');
      setModo('reloj');
      setT0(0);
      setT1(48);
    } else {
      setSitioAId('marte-gale');
      setSitioBId('luna-mare');
      setModo('ciclo');
      setT0(0);
      setT1(48);
    }
  };

  const restablecerTodo = () => {
    setSitios(structuredClone(SITIOS_INICIALES));
    setSitioAId('tierra-atacama');
    setSitioBId('marte-gale');
    setModo('reloj');
    setT0(0);
    setT1(48);
    setNMuestras(240);
    setPesos({ ...PESOS_DEFAULT });
    setCriticas([...CRITICAS_DEFAULT]);
    setEscalas({ ...ESCALAS_DEFAULT });
    setUsarNasaEnVivo(false);
    setEarthLat(-24.1);
    setEarthLon(-69.9);
    setEarthStartDate('2026-06-15');
    setEarthEndDate('2026-06-16');
    setProyecciones({});
  };

  const intercambiarSitios = () => {
    setSitioAId(sitioBId);
    setSitioBId(sitioAId);
  };

  const toggleCritica = (v: VariableAnalogo) => {
    setCriticas((prev) =>
      prev.includes(v)
        ? prev.length > 1
          ? prev.filter((item) => item !== v)
          : prev
        : [...prev, v]
    );
  };

  const actualizarSitioCampo = (
    id: string,
    updater: (s: SitioAmbiental) => SitioAmbiental
  ) => {
    setSitios((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
  };

  const handleToggleNasaEnVivo = (usar: boolean) => {
    setUsarNasaEnVivo(usar);
    setSitios((prev) =>
      prev.map((s) =>
        s.id === 'tierra-atacama'
          ? {
              ...s,
              usarSerieMedida: usar && Boolean(s.serieMedida),
              nombre: usar
                ? s.serieMedida
                  ? s.nombre.includes('NASA')
                    ? s.nombre
                    : 'Tierra (Atacama · NASA Earthdata)'
                  : s.nombre
                : 'Tierra (Atacama, 2400 m)',
            }
          : s
      )
    );
  };

  const handleChangeUbicacionEarth = (
    newLat: number,
    newLon: number,
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
  ) => {
    setEarthLat(newLat);
    setEarthLon(newLon);
    setSitios((prev) =>
      prev.map((s) =>
        s.id === 'tierra-atacama'
          ? {
              ...s,
              lat: newLat,
              lon: newLon,
              nombre: nombreSitio ?? s.nombre,
              T: presetMeta?.T ? [...presetMeta.T] : s.T,
              P: presetMeta?.P ? [...presetMeta.P] : s.P,
              viento: presetMeta?.viento ? [...presetMeta.viento] : s.viento,
              luz: presetMeta?.luz ? [...presetMeta.luz] : s.luz,
              suelo: presetMeta?.suelo ? { ...presetMeta.suelo } : s.suelo,
              pendiente: presetMeta?.pendiente ?? s.pendiente,
              rugosidad: presetMeta?.rugosidad ?? s.rugosidad,
              radiacion: presetMeta?.radiacion ?? s.radiacion,
            }
          : s
      )
    );
  };

  const handleSerieNasaCargada = (serie: SerieMedidaNASA) => {
    const mean = (arr: number[]) =>
      arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
    const min = (arr: number[]) => Math.min(...arr);
    const max = (arr: number[]) => Math.max(...arr);

    const tMean = mean(serie.temperaturaK);
    const tAmp = (max(serie.temperaturaK) - min(serie.temperaturaK)) / 2;
    const pMean = mean(serie.presionPa);
    const pAmp = pMean > 0 ? (max(serie.presionPa) - min(serie.presionPa)) / (2 * pMean) : 0;
    const wMean = mean(serie.vientoMs);
    const wAmp = wMean > 0 ? (max(serie.vientoMs) - min(serie.vientoMs)) / (2 * wMean) : 0;
    const lPeak = max(serie.luzWm2);

    setSitios((prev) =>
      prev.map((s) =>
        s.id === 'tierra-atacama'
          ? {
              ...s,
              lat: serie.lat,
              lon: serie.lon,
              fuenteDatos: serie.fuente,
              serieMedida: serie,
              usarSerieMedida: usarNasaEnVivo,
              nombre: usarNasaEnVivo
                ? s.nombre.includes('NASA')
                  ? s.nombre
                  : 'Tierra (Atacama · NASA Earthdata)'
                : s.nombre,
              T: [Number(tMean.toFixed(2)), Number(tAmp.toFixed(2))],
              P: [Number(pMean.toFixed(1)), Number(pAmp.toFixed(4))],
              viento: [Number(wMean.toFixed(2)), Number(wAmp.toFixed(3))],
              luz: [Number(lPeak.toFixed(1)), null],
            }
          : s
      )
    );
  };

  const handleAplicarSitioPds = (preset: AnalogoPlanetarioPds) => {
    const targetId = preset.cuerpo === 'luna' ? 'luna-mare' : 'marte-gale';
    setSitios((prev) =>
      prev.map((s) =>
        s.id === targetId
          ? {
              ...s,
              nombre: preset.etiquetaSitio,
              lat: preset.lat,
              lon: preset.lon,
              fuenteDatos: preset.misionFuente,
              periodo: preset.periodo,
              T: [...preset.T],
              P: [...preset.P],
              viento: [...preset.viento],
              luz: [...preset.luz],
              g: preset.g,
              radiacion: preset.radiacion,
              suelo: { ...preset.suelo },
              pendiente: preset.pendiente,
              rugosidad: preset.rugosidad,
            }
          : s
      )
    );
    setProyecciones((prev) => {
      if (!prev[targetId]) return prev;
      const copia = { ...prev };
      delete copia[targetId];
      return copia;
    });
  };

  const handleActualizarCoordsPds = (
    cuerpo: 'luna' | 'marte',
    lat: number,
    lon: number
  ) => {
    const targetId = cuerpo === 'luna' ? 'luna-mare' : 'marte-gale';
    const prefijo = cuerpo === 'luna' ? 'Luna' : 'Marte';
    setSitios((prev) =>
      prev.map((s) =>
        s.id === targetId
          ? {
              ...s,
              lat,
              lon,
              nombre: `${prefijo} (${lat.toFixed(2)}°, ${lon.toFixed(2)}° · Mapa PDS)`,
            }
          : s
      )
    );
  };

  const sitioActualEditado = sitioEditando === 'A' ? sitioA : sitioB;
  const deltaPenalizacion = resultado.total - resultado.mediaSimple;

  const quotaBanner = gmpQuotaExceeded ? (
    <div className="bg-amber-950/90 border-b border-amber-700/60 text-amber-200 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50">
      <span>
        Google Maps Platform quota reached. If you are the app owner, visit{' '}
        <a
          href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold text-amber-100 hover:text-white"
        >
          maps developer site
        </a>{' '}
        for instructions to update your account.
      </span>
    </div>
  ) : null;

  const irASeccionLab = (anchorId?: string) => {
    setMobileMenuOpen(false);
    setVista('laboratorio');
    if (anchorId) {
      setTimeout(() => {
        const el = document.getElementById(anchorId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    }
  };

  const irAVista = (next: 'inicio' | 'desgaste' | 'canvas' | 'laboratorio') => {
    setMobileMenuOpen(false);
    setVista(next);
  };

  const handleApplyRecommendedPair = (
    earthPreset: AnalogoTerrestrePreset,
    pdsPreset: AnalogoPlanetarioPds,
    openView: 'canvas' | 'laboratorio'
  ) => {
    handleChangeUbicacionEarth(
      earthPreset.lat,
      earthPreset.lon,
      earthPreset.etiquetaSitio,
      earthPreset
    );
    handleAplicarSitioPds(pdsPreset);
    setSitioAId('tierra-atacama');
    setSitioBId(pdsPreset.cuerpo === 'luna' ? 'luna-mare' : 'marte-gale');
    setModo(pdsPreset.cuerpo === 'luna' ? 'ciclo' : 'reloj');
    if (openView === 'canvas') {
      setVista('canvas');
    } else {
      irASeccionLab('resumen');
    }
  };

  const labBridge: LabTelemetryBridge = useMemo(() => {
    const sT = sitiosEfectivos.find((s) => s.id === 'tierra-atacama') ?? sitioTierra;
    const sM = sitiosEfectivos.find((s) => s.id === 'marte-gale') ?? sitioMarte;
    const sL = sitiosEfectivos.find((s) => s.id === 'luna-mare') ?? sitioLuna;
    return {
      sitioTierra: sT,
      sitioMarte: sM,
      sitioLuna: sL,
      sitioActivoA: sitioA,
      sitioActivoB: sitioB,
      similitudTotalPct: resultado.total,
      usaNasaEnVivo: usarNasaEnVivo,
      earthLat,
      earthLon,
      earthStartDate,
      earthEndDate,
      proyeccionMarteActiva: Boolean(proyecciones['marte-gale']?.activa),
      proyeccionLunaActiva: Boolean(proyecciones['luna-mare']?.activa),
      proyeccionTierraActiva: Boolean(proyecciones['tierra-atacama']?.activa),
    };
  }, [
    sitiosEfectivos,
    sitioTierra,
    sitioMarte,
    sitioLuna,
    sitioA,
    sitioB,
    resultado.total,
    usarNasaEnVivo,
    earthLat,
    earthLon,
    earthStartDate,
    earthEndDate,
    proyecciones,
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#07090E] text-slate-100 overflow-x-hidden">
      {quotaBanner}
      {/* Barra superior: 3 zonas limpias en escritorio y menú hamburguesa solo en móvil */}
      <header className="sticky top-0 z-30 border-b bg-[#0B0E17] border-slate-800">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => irAVista('inicio')}
            className="text-base font-bold tracking-tight whitespace-nowrap shrink-0 text-slate-100 hover:text-cyan-300 transition-colors"
          >
            Análogo Planetario
          </button>

          <nav
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400"
            aria-label="Navegación principal"
          >
            <button
              type="button"
              onClick={() => irAVista('inicio')}
              className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                vista === 'inicio'
                  ? 'text-cyan-400 underline'
                  : 'hover:text-slate-100'
              }`}
            >
              Inicio
            </button>
            <button
              type="button"
              onClick={() => irAVista('canvas')}
              className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                vista === 'canvas'
                  ? 'text-cyan-400 underline'
                  : 'hover:text-slate-100'
              }`}
            >
              Motor Canvas
            </button>
            <button
              type="button"
              onClick={() => irASeccionLab('resumen')}
              className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                vista === 'laboratorio'
                  ? 'text-cyan-400 underline'
                  : 'hover:text-slate-100'
              }`}
            >
              Instrumentos
            </button>
            <button
              type="button"
              onClick={() => irASeccionLab('pds-planetario')}
              className="hidden lg:inline-block hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 hover:text-slate-100"
            >
              Luna y Marte
            </button>
            <button
              type="button"
              onClick={() => irASeccionLab('modelos-ml')}
              className="hidden xl:inline-block hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 hover:text-slate-100"
            >
              Modelos ML
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => irAVista('desgaste')}
              className={`hidden md:inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                vista === 'desgaste'
                  ? 'bg-cyan-300 text-slate-950'
                  : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Pruebas de Desgaste 3D
            </button>

            {/* Botón hamburguesa exclusivo para pantalla móvil */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md border border-slate-700 bg-[#07090E] text-slate-100 hover:border-cyan-400"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Cajón de navegación exclusivo para móvil */}
        {mobileMenuOpen && (
          <nav
            aria-label="Menú móvil"
            className="md:hidden border-t border-slate-800 bg-[#0B0E17] px-4 py-3 space-y-1.5"
          >
            <button
              type="button"
              onClick={() => irAVista('inicio')}
              className={`w-full min-h-[44px] px-3 rounded-md text-left text-sm font-medium flex items-center justify-between ${
                vista === 'inicio'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>Inicio</span>
            </button>
            <button
              type="button"
              onClick={() => irAVista('desgaste')}
              className={`w-full min-h-[44px] px-3 rounded-md text-left text-sm font-semibold flex items-center justify-between ${
                vista === 'desgaste'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
              }`}
            >
              <span>Pruebas de Desgaste 3D</span>
              <ShieldAlert className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => irAVista('canvas')}
              className={`w-full min-h-[44px] px-3 rounded-md text-left text-sm font-medium ${
                vista === 'canvas'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-200 hover:bg-slate-900'
              }`}
            >
              Motor Físico Canvas 2D
            </button>
            <button
              type="button"
              onClick={() => irASeccionLab('resumen')}
              className={`w-full min-h-[44px] px-3 rounded-md text-left text-sm font-medium ${
                vista === 'laboratorio'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-200 hover:bg-slate-900'
              }`}
            >
              Instrumentos del Laboratorio
            </button>
            <button
              type="button"
              onClick={() => irASeccionLab('earthdata')}
              className="w-full min-h-[44px] px-3 rounded-md text-left text-sm font-medium text-slate-300 hover:bg-slate-900"
            >
              Satélites Tierra (NASA Earthdata)
            </button>
            <button
              type="button"
              onClick={() => irASeccionLab('pds-planetario')}
              className="w-full min-h-[44px] px-3 rounded-md text-left text-sm font-medium text-slate-300 hover:bg-slate-900"
            >
              Mapas Luna y Marte (PDS)
            </button>
            <button
              type="button"
              onClick={() => irASeccionLab('modelos-ml')}
              className="w-full min-h-[44px] px-3 rounded-md text-left text-sm font-medium text-slate-300 hover:bg-slate-900"
            >
              Modelos de Machine Learning
            </button>
          </nav>
        )}
      </header>

      {vista === 'inicio' ? (
        <HomePortal
          onLaunchWearStudio={(targetPdsId, hardwareId) => {
            setWearTargetPdsId(targetPdsId);
            setWearHardwareId(hardwareId);
            setVista('desgaste');
          }}
          onNavigateView={(view, anchor) => {
            if (view === 'laboratorio') {
              irASeccionLab(anchor);
            } else {
              setVista(view);
            }
          }}
        />
      ) : vista === 'desgaste' ? (
        <WearTestStudio
          initialTargetPdsId={wearTargetPdsId}
          initialHardwareId={wearHardwareId}
          labBridge={labBridge}
          onApplyPairToApp={handleApplyRecommendedPair}
          onNavigateLab={irASeccionLab}
        />
      ) : vista === 'canvas' ? (
        <CanvasEngineWorkspace
          sitios={sitios}
          sitioA={sitioA}
          sitioB={sitioB}
          sitioAId={sitioAId}
          sitioBId={sitioBId}
          resultado={resultado}
          criticas={criticas}
          pesos={pesos}
          earthLat={earthLat}
          earthLon={earthLon}
          sitioMarteNombre={sitioMarte.nombre}
          sitioLunaNombre={sitioLuna.nombre}
          onChangeSitioAId={setSitioAId}
          onChangeSitioBId={setSitioBId}
          onSwapSitios={intercambiarSitios}
          onSelectPresetPair={aplicarPreset}
          onSelectEarthPreset={(p) =>
            handleChangeUbicacionEarth(p.lat, p.lon, p.etiquetaSitio, p)
          }
          onSelectPdsPreset={handleAplicarSitioPds}
          onOpenLab={() => irASeccionLab('pds-planetario')}
        />
      ) : (
        <>
          {/* Cinta de calibración y casos estándar */}
          <div className="bg-[#0B0E17] border-b border-slate-800">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-400 mr-1 whitespace-nowrap">
                  Casos de analogo.py:
                </span>
                <button
                  type="button"
                  onClick={() => aplicarPreset('t-m')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                    presetActivo === 't-m'
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-[#07090E] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  Tierra vs Marte (0–48 h)
                </button>
                <button
                  type="button"
                  onClick={() => aplicarPreset('t-l')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                    presetActivo === 't-l'
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-[#07090E] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  Tierra vs Luna (0–48 h)
                </button>
                <button
                  type="button"
                  onClick={() => aplicarPreset('m-l')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                    presetActivo === 'm-l'
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-[#07090E] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  Marte vs Luna (ciclo)
                </button>
                <button
                  type="button"
                  onClick={restablecerTodo}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-800 bg-[#07090E] text-slate-300 hover:border-slate-600 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restablecer
                </button>
              </div>

              <div className="text-xs font-mono tabular-nums text-slate-400 flex items-center gap-2">
                <span>Modo {modo}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {modo === 'ciclo'
                    ? `Ciclo ${sitioA.periodo} h vs ${sitioB.periodo} h`
                    : `Ventana (${ventana[0]}, ${ventana[1]}) h`}
                </span>
                <span aria-hidden="true">·</span>
                <span>n = {nMuestras}</span>
              </div>
            </div>
          </div>

          {/* Consola asimétrica principal */}
          <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6 items-start">
            {/* Columna izquierda de parámetros y calibración */}
            <aside className="w-full lg:w-[340px] shrink-0 space-y-4">
              {/* Selección de sitios */}
              <div className="bg-[#0D121D] border border-slate-800 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-sm font-semibold text-slate-100">
                    Parámetros de comparación
                  </h1>
                  <button
                    type="button"
                    onClick={intercambiarSitios}
                    className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400"
                    title="Intercambiar Sitio A y Sitio B"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    Intercambiar
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="select-sitio-a"
                      className="block text-xs font-medium text-cyan-300 mb-1"
                    >
                      Sitio A (referencia)
                    </label>
                    <select
                      id="select-sitio-a"
                      value={sitioAId}
                      onChange={(e) => setSitioAId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#07090E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-cyan-400"
                    >
                      {sitios.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="select-sitio-b"
                      className="block text-xs font-medium text-amber-300 mb-1"
                    >
                      Sitio B (objetivo)
                    </label>
                    <select
                      id="select-sitio-b"
                      value={sitioBId}
                      onChange={(e) => setSitioBId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#07090E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-amber-400"
                    >
                      {sitios.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Selector rápido de locaciones por cuerpo */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <span className="block text-xs font-medium text-slate-300">
                    Locación calibrada por cuerpo
                  </span>

                  <div>
                    <label
                      htmlFor="sidebar-loc-tierra"
                      className="block text-[11px] text-slate-400 mb-0.5"
                    >
                      Tierra ({ANALOGOS_TERRESTRES_NASA.length} locaciones)
                    </label>
                    <select
                      id="sidebar-loc-tierra"
                      value={
                        ANALOGOS_TERRESTRES_NASA.find(
                          (p) =>
                            Math.abs(p.lat - earthLat) < 0.02 &&
                            Math.abs(p.lon - earthLon) < 0.02
                        )?.id ?? ''
                      }
                      onChange={(e) => {
                        const p = ANALOGOS_TERRESTRES_NASA.find(
                          (item) => item.id === e.target.value
                        );
                        if (p) {
                          handleChangeUbicacionEarth(p.lat, p.lon, p.etiquetaSitio, p);
                        }
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                    >
                      {!ANALOGOS_TERRESTRES_NASA.some(
                        (p) =>
                          Math.abs(p.lat - earthLat) < 0.02 &&
                          Math.abs(p.lon - earthLon) < 0.02
                      ) && <option value="">Coordenadas personalizadas</option>}
                      {ANALOGOS_TERRESTRES_NASA.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="sidebar-loc-marte"
                      className="block text-[11px] text-slate-400 mb-0.5"
                    >
                      Marte (
                      {ANALOGOS_LUNA_MARTE_PDS.filter((p) => p.cuerpo === 'marte').length}{' '}
                      locaciones)
                    </label>
                    <select
                      id="sidebar-loc-marte"
                      value={
                        ANALOGOS_LUNA_MARTE_PDS.find(
                          (p) =>
                            p.cuerpo === 'marte' && p.etiquetaSitio === sitioMarte.nombre
                        )?.id ?? 'marte-gale-msl'
                      }
                      onChange={(e) => {
                        const p = ANALOGOS_LUNA_MARTE_PDS.find(
                          (item) => item.id === e.target.value
                        );
                        if (p) handleAplicarSitioPds(p);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                    >
                      {ANALOGOS_LUNA_MARTE_PDS.filter((p) => p.cuerpo === 'marte').map(
                        (p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="sidebar-loc-luna"
                      className="block text-[11px] text-slate-400 mb-0.5"
                    >
                      Luna (
                      {ANALOGOS_LUNA_MARTE_PDS.filter((p) => p.cuerpo === 'luna').length}{' '}
                      locaciones)
                    </label>
                    <select
                      id="sidebar-loc-luna"
                      value={
                        ANALOGOS_LUNA_MARTE_PDS.find(
                          (p) =>
                            p.cuerpo === 'luna' && p.etiquetaSitio === sitioLuna.nombre
                        )?.id ?? 'luna-mare-ecuador'
                      }
                      onChange={(e) => {
                        const p = ANALOGOS_LUNA_MARTE_PDS.find(
                          (item) => item.id === e.target.value
                        );
                        if (p) handleAplicarSitioPds(p);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                    >
                      {ANALOGOS_LUNA_MARTE_PDS.filter((p) => p.cuerpo === 'luna').map(
                        (p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                {/* Selector de modo */}
                <div className="pt-3 border-t border-slate-800">
                  <span className="block text-xs font-medium text-slate-300 mb-1.5">
                    Modo de muestreo temporal
                  </span>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-md">
                    <button
                      type="button"
                      onClick={() => setModo('reloj')}
                      className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                        modo === 'reloj'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      Reloj (horas)
                    </button>
                    <button
                      type="button"
                      onClick={() => setModo('ciclo')}
                      className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                        modo === 'ciclo'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      Ciclo local
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
                    {modo === 'reloj'
                      ? 'Evalúa ambos terrenos durante las mismas horas absolutas [t₀, t₁].'
                      : 'Evalúa cada cuerpo sobre su día local completo (útil para el ciclo lunar de 708.7 h).'}
                  </p>
                </div>

                {/* Ventana de tiempo */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">
                      Ventana temporal (horas)
                    </span>
                    <span className="text-xs font-mono tabular-nums text-cyan-300">
                      ({ventana[0]}, {ventana[1]}) h
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="input-t0"
                        className="block text-[11px] text-slate-400 mb-1"
                      >
                        Inicio t₀ (h)
                      </label>
                      <input
                        id="input-t0"
                        type="number"
                        min={0}
                        max={720}
                        value={t0}
                        disabled={modo === 'ciclo'}
                        onChange={(e) => setT0(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 disabled:opacity-40 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="input-t1"
                        className="block text-[11px] text-slate-400 mb-1"
                      >
                        Fin t₁ (h)
                      </label>
                      <input
                        id="input-t1"
                        type="number"
                        min={1}
                        max={1500}
                        value={t1}
                        disabled={modo === 'ciclo'}
                        onChange={(e) => setT1(Math.max(1, Number(e.target.value) || 48))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 disabled:opacity-40 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <label htmlFor="range-t1">Duración de ventana</label>
                      <span className="font-mono tabular-nums text-slate-200">{ventana[1] - ventana[0]} h</span>
                    </div>
                    <input
                      id="range-t1"
                      type="range"
                      min={6}
                      max={720}
                      step={6}
                      disabled={modo === 'ciclo'}
                      value={Math.min(720, Math.max(6, t1 - t0))}
                      onChange={(e) => setT1(t0 + Number(e.target.value))}
                      className="w-full accent-cyan-400 disabled:opacity-40"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <label htmlFor="range-n">Muestras discretas (n)</label>
                      <span className="font-mono tabular-nums text-slate-200">{nMuestras}</span>
                    </div>
                    <input
                      id="range-n"
                      type="range"
                      min={48}
                      max={720}
                      step={24}
                      value={nMuestras}
                      onChange={(e) => setNMuestras(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              </div>

              {/* Acordeón: Pesos y variables críticas */}
              <div className="bg-[#0D121D] border border-slate-800 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAbrirPesos((v) => !v)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-left text-sm font-semibold text-slate-100 hover:bg-slate-900/50 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400"
                >
                  <span>Pesos y variables críticas</span>
                  {abrirPesos ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {abrirPesos && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-800 space-y-3">
                    <p className="text-[11px] text-slate-400">
                      Marca una variable como crítica si su caída debe penalizar el índice total
                      mediante 0.5·media + 0.5·mín(críticas).
                    </p>
                    {ORDEN_VARIABLES.map((v) => (
                      <div key={v} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={criticas.includes(v)}
                              onChange={() => toggleCritica(v)}
                              className="rounded border-slate-600 bg-[#07090E] accent-cyan-400"
                            />
                            <span>{METADATOS_VARIABLES[v].etiqueta}</span>
                          </label>
                          <span className="font-mono tabular-nums text-cyan-300">
                            w = {pesos[v].toFixed(1)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={5}
                          step={0.5}
                          value={pesos[v]}
                          onChange={(e) =>
                            setPesos((prev) => ({
                              ...prev,
                              [v]: Number(e.target.value),
                            }))
                          }
                          aria-label={`Peso de ${METADATOS_VARIABLES[v].etiqueta}`}
                          className="w-full accent-cyan-400"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Acordeón: Editor de parámetros físicos del sitio */}
              <div className="bg-[#0D121D] border border-slate-800 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAbrirParametros((v) => !v)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-left text-sm font-semibold text-slate-100 hover:bg-slate-900/50 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400"
                >
                  <span>Calibrar datos del sitio</span>
                  {abrirParametros ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {abrirParametros && (
                  <div className="px-5 pb-5 pt-3 border-t border-slate-800 space-y-3">
                    <div className="grid grid-cols-2 gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-md">
                      <button
                        type="button"
                        onClick={() => setSitioEditando('A')}
                        className={`px-2 py-1 text-xs font-medium rounded truncate ${
                          sitioEditando === 'A'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'text-slate-400'
                        }`}
                      >
                        Editar A
                      </button>
                      <button
                        type="button"
                        onClick={() => setSitioEditando('B')}
                        className={`px-2 py-1 text-xs font-medium rounded truncate ${
                          sitioEditando === 'B'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'text-slate-400'
                        }`}
                      >
                        Editar B
                      </button>
                    </div>

                    <div className="text-xs font-medium text-slate-200 truncate">
                      {sitioActualEditado.nombre}
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">
                          Periodo (h)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={sitioActualEditado.periodo}
                          onChange={(e) =>
                            actualizarSitioCampo(sitioActualEditado.id, (s) => ({
                              ...s,
                              periodo: Math.max(1, Number(e.target.value) || 24),
                            }))
                          }
                          className="w-full px-2 py-1 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">
                          Gravedad (m/s²)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={sitioActualEditado.g}
                          onChange={(e) =>
                            actualizarSitioCampo(sitioActualEditado.id, (s) => ({
                              ...s,
                              g: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-full px-2 py-1 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">
                          T media (K)
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={sitioActualEditado.T[0]}
                          onChange={(e) =>
                            actualizarSitioCampo(sitioActualEditado.id, (s) => ({
                              ...s,
                              T: [Number(e.target.value) || 0, s.T[1]],
                            }))
                          }
                          className="w-full px-2 py-1 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">
                          T amplitud (K)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={sitioActualEditado.T[1]}
                          onChange={(e) =>
                            actualizarSitioCampo(sitioActualEditado.id, (s) => ({
                              ...s,
                              T: [s.T[0], Math.max(0, Number(e.target.value) || 0)],
                            }))
                          }
                          className="w-full px-2 py-1 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">
                          Presión media (Pa)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={sitioActualEditado.P[0]}
                          onChange={(e) =>
                            actualizarSitioCampo(sitioActualEditado.id, (s) => ({
                              ...s,
                              P: [Math.max(0, Number(e.target.value) || 0), s.P[1]],
                            }))
                          }
                          className="w-full px-2 py-1 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">
                          Radiación (µSv/h)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          value={sitioActualEditado.radiacion}
                          onChange={(e) =>
                            actualizarSitioCampo(sitioActualEditado.id, (s) => ({
                              ...s,
                              radiacion: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-full px-2 py-1 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">
                          Viento medio (m/s)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={sitioActualEditado.viento[0]}
                          onChange={(e) =>
                            actualizarSitioCampo(sitioActualEditado.id, (s) => ({
                              ...s,
                              viento: [Math.max(0, Number(e.target.value) || 0), s.viento[1]],
                            }))
                          }
                          className="w-full px-2 py-1 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">
                          Luz pico (W/m²)
                        </label>
                        <input
                          type="number"
                          step="10"
                          min="0"
                          value={sitioActualEditado.luz[0]}
                          onChange={(e) =>
                            actualizarSitioCampo(sitioActualEditado.id, (s) => ({
                              ...s,
                              luz: [Math.max(0, Number(e.target.value) || 0), s.luz[1]],
                            }))
                          }
                          className="w-full px-2 py-1 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">
                          Pendiente (°)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="90"
                          value={sitioActualEditado.pendiente}
                          onChange={(e) =>
                            actualizarSitioCampo(sitioActualEditado.id, (s) => ({
                              ...s,
                              pendiente: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-full px-2 py-1 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-0.5">
                          Rugosidad (m)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={sitioActualEditado.rugosidad}
                          onChange={(e) =>
                            actualizarSitioCampo(sitioActualEditado.id, (s) => ({
                              ...s,
                              rugosidad: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-full px-2 py-1 font-mono tabular-nums bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* Área principal de resultados e instrumentación */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Resumen Ejecutivo */}
              <section
                id="resumen"
                className="bg-[#0D121D] border border-slate-800 rounded-lg p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">
                      <span className="text-cyan-300">{sitioA.nombre}</span> vs{' '}
                      <span className="text-amber-300">{sitioB.nombre}</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Índice de analogía ambiental basado en distancia de Wasserstein,
                      variación total química y penalización por variables críticas
                    </p>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-400">
                    100.0 % = entornos idénticos
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800 pt-4">
                  <div className="pb-4 md:pb-0 md:pr-6">
                    <div className="text-xs font-medium text-slate-400">
                      Similitud total penalizada
                    </div>
                    <div className="mt-1 flex items-baseline">
                      <span className="text-3xl font-mono font-bold tabular-nums text-cyan-300">
                        {resultado.total.toFixed(1)}
                      </span>
                      <span className="text-xs uppercase font-mono text-slate-400 ml-1.5">
                        %
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs font-mono text-slate-400">
                      {resultado.penalizado ? (
                        <span className="text-amber-300">
                          ▲ Penalizada por {METADATOS_VARIABLES[resultado.peorCritica.variable].etiqueta.toLowerCase()} (
                          {resultado.peorCritica.valor.toFixed(1)}%)
                        </span>
                      ) : (
                        <span className="text-emerald-400">
                          ● Sin penalización crítica adicional
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="py-4 md:py-0 md:px-6">
                    <div className="text-xs font-medium text-slate-400">
                      Media ponderada directa
                    </div>
                    <div className="mt-1 flex items-baseline">
                      <span className="text-3xl font-mono font-bold tabular-nums text-slate-100">
                        {resultado.mediaSimple.toFixed(1)}
                      </span>
                      <span className="text-xs uppercase font-mono text-slate-400 ml-1.5">
                        %
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs font-mono tabular-nums text-slate-400">
                      Diferencia por penalización: {deltaPenalizacion.toFixed(1)} %
                    </div>
                  </div>

                  <div className="pt-4 md:pt-0 md:pl-6">
                    <div className="text-xs font-medium text-slate-400">
                      Constantes físicas directas
                    </div>
                    <div className="mt-2 space-y-1 text-xs font-mono tabular-nums text-slate-200">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Gravedad (A / B):</span>
                        <span>
                          {sitioA.g.toFixed(2)} / {sitioB.g.toFixed(2)} m/s²
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Radiación (A / B):</span>
                        <span>
                          {formatoCientifico(sitioA.radiacion)} /{' '}
                          {formatoCientifico(sitioB.radiacion)} µSv/h
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Día local (A / B):</span>
                        <span>
                          {sitioA.periodo.toFixed(1)} / {sitioB.periodo.toFixed(1)} h
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Radar y Tabla de Desglose por Variable */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
                <div className="xl:col-span-5 bg-[#0D121D] border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
                  <div className="pb-3 border-b border-slate-800">
                    <h2 className="text-base font-semibold text-slate-100">
                      Perfil multidimensional
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Distribución radial Canvas de las 9 métricas de similitud
                    </p>
                  </div>
                  <div className="my-auto pt-3">
                    <RadarChart
                      resultado={resultado}
                      pesos={pesos}
                      criticas={criticas}
                    />
                  </div>
                </div>

                <div className="xl:col-span-7 bg-[#0D121D] border border-slate-800 rounded-lg p-5 flex flex-col">
                  <div className="pb-3 border-b border-slate-800 flex items-baseline justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold text-slate-100">
                        Desglose por variable
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Similitud cuantílica, correlación de forma temporal y ponderación
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      9 dimensiones
                    </span>
                  </div>

                  <div className="mt-3 overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-400">
                          <th className="py-2 pr-3">Variable</th>
                          <th className="py-2 px-3 text-right">Similitud</th>
                          <th className="py-2 px-3 w-32 hidden sm:table-cell">Nivel</th>
                          <th className="py-2 px-3 text-right">Forma (r)</th>
                          <th className="py-2 pl-3 text-right">Peso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70 text-xs">
                        {ORDEN_VARIABLES.map((v) => {
                          const val = resultado.porVariable[v];
                          const esCritica = criticas.includes(v);
                          const corr =
                            v === 'temperatura' ||
                            v === 'luz' ||
                            v === 'viento' ||
                            v === 'presion'
                              ? resultado.correlacionTemporal[v]
                              : null;

                          return (
                            <tr key={v} className="hover:bg-slate-900/50">
                              <td className="py-2.5 pr-3">
                                <div className="font-medium text-slate-100">
                                  {METADATOS_VARIABLES[v].etiqueta}
                                  {esCritica && (
                                    <span className="ml-1.5 text-[11px] font-normal text-amber-300">
                                      · crítica
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {METADATOS_VARIABLES[v].transformacion}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-slate-100">
                                {val.toFixed(1)}%
                              </td>
                              <td className="py-2.5 px-3 hidden sm:table-cell">
                                <div className="h-2 w-full bg-[#07090E] border border-slate-800 rounded-xs overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      esCritica && val < 25
                                        ? 'bg-amber-400'
                                        : 'bg-cyan-400'
                                    }`}
                                    style={{ width: `${Math.max(2, val)}%` }}
                                  />
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                                {corr !== null && corr !== undefined
                                  ? `${corr >= 0 ? '+' : ''}${corr.toFixed(2)}`
                                  : '—'}
                              </td>
                              <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-400">
                                {pesos[v].toFixed(1)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

          {/* Datos terrestres en vivo: NASA Earthdata Search & Worldview */}
          <EarthdataPanel
            usarNasaEnVivo={usarNasaEnVivo}
            onToggleNasaEnVivo={handleToggleNasaEnVivo}
            lat={earthLat}
            lon={earthLon}
            startDate={earthStartDate}
            endDate={earthEndDate}
            onChangeUbicacion={handleChangeUbicacionEarth}
            onChangeFechas={(s, e) => {
              setEarthStartDate(s);
              setEarthEndDate(e);
            }}
            onSerieCargada={handleSerieNasaCargada}
            serieActual={sitioTierra.serieMedida}
          />

          {/* Datos de Luna y Marte: NASA PDS & WUSTL Geosciences (LRO / MGS / MSL) */}
          <PdsPanel
            onAplicarSitioPds={handleAplicarSitioPds}
            onActualizarCoordsPds={handleActualizarCoordsPds}
            sitioLunaNombre={sitioLuna.nombre}
            sitioMarteNombre={sitioMarte.nombre}
          />

          {/* Proyección latitudinal de temperatura (lineal / sinusoidal) */}
          <LatitudeProjectionPanel
            sitioA={sitioABase}
            sitioB={sitioBBase}
            objetivo={proyeccionObjetivo}
            onChangeObjetivo={setProyeccionObjetivo}
            config={proyeccionActual}
            onChangeConfig={(next) =>
              setProyecciones((prev) => ({
                ...prev,
                [sitioObjetivoBase.id]: next,
              }))
            }
            onResetSitio={() =>
              setProyecciones((prev) => {
                const copia = { ...prev };
                delete copia[sitioObjetivoBase.id];
                return copia;
              })
            }
          />

          {/* Series temporales */}
          <TimeSeriesPanel resultado={resultado} />

          {/* Composición de aire y suelo */}
          <CompositionPanel
            sitioA={sitioA}
            sitioB={sitioB}
            resultado={resultado}
          />

          {/* Modelos ML: Ensambles de Clima y Similitud */}
          <MlPanel
            sitioANombre={sitioA.nombre}
            sitioBNombre={sitioB.nombre}
            ventana={ventana}
            modo={modo}
            earthLat={earthLat}
            earthLon={earthLon}
            earthStartDate={earthStartDate}
            earthEndDate={earthEndDate}
            refreshSignal={mlRefreshSignal}
          />

          {/* Ingesta, verificación Google Search Grounding, lista blanca oficial y Firebase */}
          <WhitelistVerifyPanel
            onDatosActualizados={() => setMlRefreshSignal((n) => n + 1)}
          />

          {/* Salida exacta de consola */}
          <ConsoleOutput sitios={sitiosEfectivos} resultadoActivo={resultado} />
        </div>
      </main>
        </>
      )}
    </div>
  );
}

export default App;
