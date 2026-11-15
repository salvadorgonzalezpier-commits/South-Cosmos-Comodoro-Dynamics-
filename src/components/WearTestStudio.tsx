import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Compass,
  Download,
  ExternalLink,
  Layers,
  Pause,
  Play,
  Printer,
  RotateCcw,
  Shield,
  ShieldCheck,
  Thermometer,
  Upload,
} from 'lucide-react';
import {
  ANALOGOS_LUNA_MARTE_PDS,
  AnalogoPlanetarioPds,
  AnalogoTerrestrePreset,
  PerfilRecomendacion,
  recomendarAnalogosTerrestres,
  SitioAmbiental,
  sitioDesdePresetPds,
} from '../lib/analogo';
import {
  BLINDAJES_RADIACION,
  BlindajeMaterialId,
  calcularBlindajeRadiacion,
  calcularDesgasteEnDia,
  compararMaterialesYRecubrimientos,
  CustomModelPayload,
  diagnosticarComponentesHardware,
  HardwareSpec,
  LabTelemetryBridge,
  MATERIALES_INGENIERIA,
  MaterialTipo,
  parseCustomJsonSpec,
  parseObjModel,
  PRESET_HARDWARE_SPECS,
  RECUBRIMIENTOS_NASA,
  RecubrimientoTipo,
  SAMPLE_OBJ_ROVER,
  simularCurvaDesgaste,
  simularFatigaCiclosDiaNoche,
  ThermalCyclePoint,
  WearCurvePoint,
  WearVisualMode,
  ZONAS_DESPLIEGUE,
  ZonaDespliegueId,
} from '../lib/wearEngine';
import { Wear3DViewport, Wear3DViewportHandle } from './Wear3DViewport';

interface WearTestStudioProps {
  initialTargetPdsId?: string;
  initialHardwareId?: string;
  labBridge: LabTelemetryBridge;
  onApplyPairToApp: (
    earthPreset: AnalogoTerrestrePreset,
    pdsPreset: AnalogoPlanetarioPds,
    openView: 'canvas' | 'laboratorio'
  ) => void;
  onNavigateLab: (anchor?: string) => void;
}

type StudioTabId =
  | 'analogos'
  | 'comparador'
  | 'radiacion'
  | 'ciclos'
  | 'ficha';

const WearStripChartCanvas: React.FC<{
  curva: WearCurvePoint[];
  diaActual: number;
  maxDias: number;
}> = ({ curva, diaActual, maxDias }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [w, setW] = useState(640);
  const [hoverDia, setHoverDia] = useState<number | null>(null);
  const h = 185;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width >= 120) setW(Math.round(r.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, w, h);

    const padL = 42;
    const padR = 14;
    const padT = 18;
    const padB = 26;
    const plotW = Math.max(40, w - padL - padR);
    const plotH = Math.max(40, h - padT - padB);

    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const val of [0, 25, 50, 75, 100]) {
      const y = padT + (1 - val / 100) * plotH;
      ctx.strokeStyle = val === 50 ? '#334155' : '#1E293B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();

      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`${val}%`, padL - 6, y);
    }

    const drawLine = (
      accessor: (pt: WearCurvePoint) => number,
      color: string,
      width: number,
      dash: number[] = []
    ) => {
      if (curva.length < 2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      curva.forEach((pt, idx) => {
        const x = padL + (pt.dia / maxDias) * plotW;
        const y = padT + (1 - accessor(pt) / 100) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };

    drawLine((p) => p.integridad, '#06B6D4', 2.2);
    drawLine((p) => p.abrasion, '#F59E0B', 1.6);
    drawLine((p) => p.termica, '#EF4444', 1.5, [4, 3]);
    drawLine((p) => p.radiacion, '#A855F7', 1.4, [2, 3]);

    const curX = padL + (Math.min(diaActual, maxDias) / maxDias) * plotW;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(curX, padT);
    ctx.lineTo(curX, padT + plotH);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#94A3B8';
    for (let i = 0; i <= 4; i++) {
      const d = Math.round((i / 4) * maxDias);
      const x = padL + (i / 4) * plotW;
      ctx.fillText(`${d}d`, x, padT + plotH + 6);
    }

    if (hoverDia !== null) {
      const hx = padL + (hoverDia / maxDias) * plotW;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hx, padT);
      ctx.lineTo(hx, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [curva, diaActual, hoverDia, maxDias, w]);

  return (
    <div ref={wrapRef} className="w-full relative">
      <canvas
        ref={canvasRef}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const padL = 42;
          const padR = 14;
          const plotW = Math.max(40, w - padL - padR);
          const frac = Math.max(0, Math.min(1, (e.clientX - rect.left - padL) / plotW));
          setHoverDia(Math.round(frac * maxDias));
        }}
        onMouseLeave={() => setHoverDia(null)}
        className="block rounded border border-slate-800 cursor-crosshair"
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400">
        <span className="text-cyan-300">— Integridad</span>
        <span className="text-amber-300">— Abrasión</span>
        <span className="text-rose-400">-- Térmica</span>
        <span className="text-purple-400">· · Radiación</span>
        {hoverDia !== null && <span className="text-slate-200 ml-auto">Cursor: día {hoverDia}</span>}
      </div>
    </div>
  );
};

const ThermalCycleCanvas: React.FC<{
  puntos: ThermalCyclePoint[];
  maxCiclos: number;
}> = ({ puntos, maxCiclos }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [w, setW] = useState(640);
  const h = 185;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width >= 120) setW(Math.round(r.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, w, h);

    const padL = 42;
    const padR = 14;
    const padT = 18;
    const padB = 26;
    const plotW = Math.max(40, w - padL - padR);
    const plotH = Math.max(40, h - padT - padB);

    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const val of [0, 25, 50, 75, 100]) {
      const y = padT + (1 - val / 100) * plotH;
      ctx.strokeStyle = val === 50 ? '#334155' : '#1E293B';
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`${val}%`, padL - 6, y);
    }

    const drawSeries = (acc: (p: ThermalCyclePoint) => number, color: string, dash: number[] = []) => {
      if (puntos.length < 2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      puntos.forEach((pt, idx) => {
        const x = padL + (pt.ciclo / maxCiclos) * plotW;
        const y = padT + (1 - acc(pt) / 100) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };

    drawSeries((p) => p.integridadEstructural, '#06B6D4');
    drawSeries((p) => p.retencionPotencia, '#10B981', [5, 3]);
    drawSeries((p) => p.fatigaSellos, '#F59E0B');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#94A3B8';
    for (let i = 0; i <= 4; i++) {
      const c = Math.round((i / 4) * maxCiclos);
      const x = padL + (i / 4) * plotW;
      ctx.fillText(`${c}c`, x, padT + plotH + 6);
    }
  }, [puntos, maxCiclos, w]);

  return (
    <div ref={wrapRef} className="w-full">
      <canvas ref={canvasRef} className="block rounded border border-slate-800" />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400">
        <span className="text-cyan-300">— Integridad estructural</span>
        <span className="text-emerald-400">-- Retención solar/potencia</span>
        <span className="text-amber-300">— Fatiga acumulada en sellos</span>
      </div>
    </div>
  );
};

export const WearTestStudio: React.FC<WearTestStudioProps> = ({
  initialTargetPdsId,
  initialHardwareId,
  labBridge,
  onApplyPairToApp,
  onNavigateLab,
}) => {
  const viewportRef = useRef<Wear3DViewportHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modo de origen de datos: 'lab-marte', 'lab-luna', 'lab-tierra', o cualquier preset PDS
  const [sourceMode, setSourceMode] = useState<string>(() => {
    if (initialTargetPdsId) return `pds:${initialTargetPdsId}`;
    return 'lab-marte';
  });

  useEffect(() => {
    if (initialTargetPdsId) setSourceMode(`pds:${initialTargetPdsId}`);
  }, [initialTargetPdsId]);

  const [hardwareCatalog, setHardwareCatalog] = useState<HardwareSpec[]>(() =>
    structuredClone(PRESET_HARDWARE_SPECS)
  );
  const [selectedHwId, setSelectedHwId] = useState<string>(
    initialHardwareId ?? 'rover-6x6'
  );
  useEffect(() => {
    if (initialHardwareId) setSelectedHwId(initialHardwareId);
  }, [initialHardwareId]);

  const [recubrimiento, setRecubrimiento] = useState<RecubrimientoTipo>('hbn_ceramico');
  const [zonaId, setZonaId] = useState<ZonaDespliegueId>('planicie');
  const [visualMode, setVisualMode] = useState<WearVisualMode>('fisico');
  const [showPins, setShowPins] = useState<boolean>(true);
  const [showDustEffect, setShowDustEffect] = useState<boolean>(true);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  const [dias, setDias] = useState<number>(180);
  const [playing, setPlaying] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Pestaña inferior activa + estado de los módulos adicionales
  const [activeTab, setActiveTab] = useState<StudioTabId>('analogos');
  const [perfilFiltro, setPerfilFiltro] = useState<PerfilRecomendacion>('rover');
  const [shieldMaterial, setShieldMaterial] = useState<BlindajeMaterialId>('polietileno');
  const [shieldEspesorCm, setShieldEspesorCm] = useState<number>(12);
  const [maxCiclosSim, setMaxCiclosSim] = useState<number>(1000);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  // Resolver sitio destino activo recopilando directamente datos del laboratorio
  const { sitioDestino, origenTexto, pdsEquivalente } = useMemo(() => {
    if (sourceMode === 'lab-marte') {
      return {
        sitioDestino: labBridge.sitioMarte,
        origenTexto: labBridge.proyeccionMarteActiva
          ? 'Laboratorio (Marte · Con Proyección Latitudinal)'
          : 'Laboratorio (Marte · Datos Calibrados Instrumentos/PDS)',
        pdsEquivalente:
          ANALOGOS_LUNA_MARTE_PDS.find((p) => p.cuerpo === 'marte') ??
          ANALOGOS_LUNA_MARTE_PDS[0],
      };
    }
    if (sourceMode === 'lab-luna') {
      return {
        sitioDestino: labBridge.sitioLuna,
        origenTexto: labBridge.proyeccionLunaActiva
          ? 'Laboratorio (Luna · Con Proyección Latitudinal)'
          : 'Laboratorio (Luna · Datos Calibrados Instrumentos/PDS)',
        pdsEquivalente:
          ANALOGOS_LUNA_MARTE_PDS.find((p) => p.cuerpo === 'luna') ??
          ANALOGOS_LUNA_MARTE_PDS[0],
      };
    }
    if (sourceMode === 'lab-tierra') {
      return {
        sitioDestino: labBridge.sitioTierra,
        origenTexto: labBridge.usaNasaEnVivo
          ? `Laboratorio (Tierra · NASA POWER en vivo ${labBridge.earthLat.toFixed(2)}°, ${labBridge.earthLon.toFixed(2)}°)`
          : 'Laboratorio (Tierra · Calibración Instrumentos/Earthdata)',
        pdsEquivalente: ANALOGOS_LUNA_MARTE_PDS[0],
      };
    }

    const pdsId = sourceMode.replace('pds:', '');
    const preset =
      ANALOGOS_LUNA_MARTE_PDS.find((p) => p.id === pdsId) ?? ANALOGOS_LUNA_MARTE_PDS[0];
    return {
      sitioDestino: sitioDesdePresetPds(preset),
      origenTexto: `Catálogo NASA PDS (${preset.misionFuente})`,
      pdsEquivalente: preset,
    };
  }, [sourceMode, labBridge]);

  const activeHw = useMemo(
    () => hardwareCatalog.find((h) => h.id === selectedHwId) ?? hardwareCatalog[0],
    [hardwareCatalog, selectedHwId]
  );

  // Ajustar perfil recomendador acorde al equipo
  useEffect(() => {
    if (activeHw.tipo === 'rover') setPerfilFiltro('rover');
    else if (activeHw.tipo === 'traje') setPerfilFiltro('traje');
    else if (activeHw.tipo === 'base') setPerfilFiltro('base');
    else setPerfilFiltro('equilibrado');
  }, [activeHw.tipo]);

  const activeZona = useMemo(
    () => ZONAS_DESPLIEGUE.find((z) => z.id === zonaId) ?? ZONAS_DESPLIEGUE[0],
    [zonaId]
  );

  const metrics = useMemo(
    () => calcularDesgasteEnDia(sitioDestino, activeHw, activeZona, dias, recubrimiento),
    [sitioDestino, activeHw, activeZona, dias, recubrimiento]
  );

  const curva = useMemo(
    () => simularCurvaDesgaste(sitioDestino, activeHw, activeZona, 730, 60, recubrimiento),
    [sitioDestino, activeHw, activeZona, recubrimiento]
  );

  const pinDiagnostics = useMemo(
    () => diagnosticarComponentesHardware(sitioDestino, activeHw, activeZona, dias, recubrimiento),
    [sitioDestino, activeHw, activeZona, dias, recubrimiento]
  );

  useEffect(() => {
    if (!selectedPinId || !pinDiagnostics.some((p) => p.id === selectedPinId)) {
      setSelectedPinId(pinDiagnostics[0]?.id ?? null);
    }
  }, [pinDiagnostics, selectedPinId]);

  const selectedPin = useMemo(
    () => pinDiagnostics.find((p) => p.id === selectedPinId) ?? pinDiagnostics[0],
    [pinDiagnostics, selectedPinId]
  );

  const alloyRows = useMemo(
    () => compararMaterialesYRecubrimientos(sitioDestino, activeHw, activeZona, dias, recubrimiento),
    [sitioDestino, activeHw, activeZona, dias, recubrimiento]
  );

  const shieldResult = useMemo(
    () => calcularBlindajeRadiacion(sitioDestino, shieldMaterial, shieldEspesorCm, dias),
    [sitioDestino, shieldMaterial, shieldEspesorCm, dias]
  );

  const cycleSim = useMemo(
    () => simularFatigaCiclosDiaNoche(sitioDestino, activeHw, activeZona, recubrimiento, maxCiclosSim),
    [sitioDestino, activeHw, activeZona, recubrimiento, maxCiclosSim]
  );

  const recomendacionesTierra = useMemo(() => {
    const recs = recomendarAnalogosTerrestres(sitioDestino, perfilFiltro);
    return recs.slice(0, 3);
  }, [sitioDestino, perfilFiltro]);

  // Avance temporal si Play está activo
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setDias((prev) => (prev >= 730 ? 1 : Math.min(730, prev + 3)));
    }, 90);
    return () => window.clearInterval(timer);
  }, [playing]);

  const updateActiveHwField = (patch: Partial<HardwareSpec>) => {
    setHardwareCatalog((prev) =>
      prev.map((h) => (h.id === activeHw.id ? { ...h, ...patch } : h))
    );
  };

  const addCustomModel = (
    payload: CustomModelPayload,
    specPatch?: Partial<HardwareSpec>
  ) => {
    const newId = `custom-${Date.now()}`;
    const created: HardwareSpec = {
      id: newId,
      nombre:
        specPatch?.nombre ??
        payload.fileName.replace(/\.(obj|json)$/i, ''),
      tipo: 'custom',
      descripcion:
        specPatch?.descripcion ??
        `Modelo 3D importado (${payload.format.toUpperCase()} · ${payload.fileName})`,
      material: specPatch?.material ?? 'ti6al4v',
      masaKg: specPatch?.masaKg ?? 520,
      selladoKpa: specPatch?.selladoKpa ?? 25,
      tempMinK: specPatch?.tempMinK ?? 140,
      tempMaxK: specPatch?.tempMaxK ?? 380,
      blindajeBase: specPatch?.blindajeBase ?? 1.25,
      anchoRel: 1.0,
      altoRel: 1.0,
      customModel: payload,
    };
    setHardwareCatalog((prev) => [created, ...prev.slice(0, 6)]);
    setSelectedHwId(newId);
    setUploadError(null);
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const name = file.name.toLowerCase();

    if (name.endsWith('.obj')) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = parseObjModel(String(reader.result ?? ''), file.name);
          addCustomModel(payload);
        } catch (err) {
          setUploadError(
            err instanceof Error ? err.message : 'No se pudo interpretar el archivo .OBJ.'
          );
        }
      };
      reader.readAsText(file);
    } else if (name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const { specPatch, payload } = parseCustomJsonSpec(
            String(reader.result ?? ''),
            file.name
          );
          addCustomModel(payload, specPatch);
        } catch {
          setUploadError('JSON inválido: revisa la estructura del modelo.');
        }
      };
      reader.readAsText(file);
    } else {
      setUploadError('Formato soportado en el Visor 3D: .obj (malla 3D) o .json (geometría/ficha).');
    }
    e.target.value = '';
  };

  const handleDownloadJsonReport = () => {
    const payload = {
      generadoEn: new Date().toISOString(),
      origenDatos: origenTexto,
      sitio: {
        nombre: sitioDestino.nombre,
        tempMediaK: sitioDestino.T[0],
        amplitudK: sitioDestino.T[1],
        presionPa: sitioDestino.P[0],
        vientoMs: sitioDestino.viento[0],
        radiacion: sitioDestino.radiacion,
        suelo: sitioDestino.suelo,
      },
      equipo: {
        nombre: activeHw.nombre,
        material: MATERIALES_INGENIERIA[activeHw.material].nombre,
        recubrimiento: RECUBRIMIENTOS_NASA[recubrimiento].nombre,
        zonaDespliegue: activeZona.nombre,
        diasExposicion: dias,
      },
      diagnosticoGlobal: metrics,
      componentes3D: pinDiagnostics,
      comparativaAleaciones: alloyRows.map((r) => ({
        material: r.material.nombre,
        integridadPct: Number(r.integridadPct.toFixed(1)),
        vidaUtilDias: r.vidaUtilDias,
        masaKg: r.masaEstimadaKg,
      })),
      blindajeRadiacion: {
        material: BLINDAJES_RADIACION[shieldMaterial].nombre,
        espesorCm: shieldEspesorCm,
        ...shieldResult,
      },
      analogoTerrestreRecomendado: recomendacionesTierra[0]
        ? {
            nombre: recomendacionesTierra[0].preset.nombre,
            aptitudPct: Number(recomendacionesTierra[0].puntuacionPrueba.toFixed(1)),
          }
        : null,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ficha-desgaste-${activeHw.id}-d${dias}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const topSoilStr = Object.entries(sitioDestino.suelo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`)
    .join(' · ');

  const matInfo = MATERIALES_INGENIERIA[activeHw.material];
  const coatInfo = RECUBRIMIENTOS_NASA[recubrimiento];

  return (
    <div className="flex-1 bg-[#07090E] text-slate-100 print-sheet">
      <div className="max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
        {/* Sector 1: Cinta de Datos Recopilados del Laboratorio */}
        <section className="bg-[#0D121D] border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-100">
                Estudio 3D de Desgaste de Hardware y Materiales
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Origen activo: <span className="text-cyan-300 font-medium">{origenTexto}</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 no-print">
              <select
                aria-label="Seleccionar fuente o sitio para ensayo 3D"
                value={sourceMode}
                onChange={(e) => setSourceMode(e.target.value)}
                className="min-h-[44px] px-3 py-2 text-xs bg-[#07090E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-cyan-400"
              >
                <optgroup label="Datos vivos de las páginas del laboratorio">
                  <option value="lab-marte">
                    Lab en vivo · Marte ({labBridge.sitioMarte.nombre})
                  </option>
                  <option value="lab-luna">
                    Lab en vivo · Luna ({labBridge.sitioLuna.nombre})
                  </option>
                  <option value="lab-tierra">
                    Lab en vivo · Tierra ({labBridge.sitioTierra.nombre})
                  </option>
                </optgroup>
                <optgroup label="Marte (Catálogo NASA PDS)">
                  {ANALOGOS_LUNA_MARTE_PDS.filter((p) => p.cuerpo === 'marte').map((p) => (
                    <option key={p.id} value={`pds:${p.id}`}>
                      Marte · {p.nombre}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Luna (Catálogo NASA PDS)">
                  {ANALOGOS_LUNA_MARTE_PDS.filter((p) => p.cuerpo === 'luna').map((p) => (
                    <option key={p.id} value={`pds:${p.id}`}>
                      Luna · {p.nombre}
                    </option>
                  ))}
                </optgroup>
              </select>

              <button
                type="button"
                onClick={() => onNavigateLab('pds-planetario')}
                className="min-h-[44px] px-3 py-2 text-xs font-medium bg-[#07090E] border border-slate-700 hover:border-cyan-400 rounded-md text-slate-200 whitespace-nowrap"
              >
                Ajustar en Laboratorio
              </button>
            </div>
          </div>

          {/* Resumen de variables reales recopiladas de otras páginas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80 text-xs">
            <div className="p-2.5 rounded bg-[#07090E] border border-slate-800/80">
              <div className="text-[11px] text-slate-400">Térmica y Amplitud ΔT</div>
              <div className="font-mono tabular-nums text-slate-100 font-semibold mt-0.5">
                {metrics.tMinLocalK.toFixed(0)}–{metrics.tMaxLocalK.toFixed(0)} K
              </div>
              <div className="text-[11px] font-mono text-amber-300 tabular-nums">
                ΔT {(metrics.tMaxLocalK - metrics.tMinLocalK).toFixed(0)} K · {sitioDestino.periodo}h
              </div>
            </div>

            <div className="p-2.5 rounded bg-[#07090E] border border-slate-800/80">
              <div className="text-[11px] text-slate-400">Presión, Viento y Gravedad</div>
              <div className="font-mono tabular-nums text-slate-100 font-semibold mt-0.5">
                {sitioDestino.P[0].toFixed(0)} Pa · {sitioDestino.viento[0].toFixed(1)} m/s
              </div>
              <div className="text-[11px] font-mono text-cyan-300 tabular-nums">
                g = {sitioDestino.g.toFixed(2)} m/s² · Pend {sitioDestino.pendiente}°
              </div>
            </div>

            <div className="p-2.5 rounded bg-[#07090E] border border-slate-800/80">
              <div className="text-[11px] text-slate-400">Composición Regolito / Suelo</div>
              <div className="font-mono text-slate-100 font-semibold mt-0.5 truncate">
                {topSoilStr}
              </div>
              <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                Rugosidad {sitioDestino.rugosidad.toFixed(2)}
              </div>
            </div>

            <div className="p-2.5 rounded bg-[#07090E] border border-slate-800/80">
              <div className="text-[11px] text-slate-400">Radiación y Similitud Lab</div>
              <div className="font-mono tabular-nums text-slate-100 font-semibold mt-0.5">
                {sitioDestino.radiacion.toFixed(1)} u.r. · {sitioDestino.luz[0].toFixed(0)} W/m²
              </div>
              <div className="text-[11px] font-mono text-emerald-400 tabular-nums">
                Índice A↔B Lab: {labBridge.similitudTotalPct.toFixed(1)}%
              </div>
            </div>
          </div>
        </section>

        {/* Sector 2: Escenario Principal — Visor 3D Dedicado + Controles Ordenados */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Columna 3D (Primero en móvil y dominante en desktop) */}
          <div className="lg:col-span-8 space-y-3">
            <Wear3DViewport
              ref={viewportRef}
              sitio={sitioDestino}
              hardware={activeHw}
              recubrimiento={recubrimiento}
              zona={activeZona}
              dias={dias}
              visualMode={visualMode}
              onChangeVisualMode={setVisualMode}
              showPins={showPins}
              onTogglePins={() => setShowPins((v) => !v)}
              showDustEffect={showDustEffect}
              onToggleDustEffect={() => setShowDustEffect((v) => !v)}
              selectedPinId={selectedPinId}
              pinDiagnostics={pinDiagnostics}
              onSelectPin={(pid) => setSelectedPinId(pid)}
            />

            {/* Selector táctil sincronizado de Pines 3D (cómodo en móvil y escritorio) */}
            <div className="bg-[#0D121D] border border-slate-800 rounded-lg p-3 space-y-2.5 no-print">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-200">
                  Inspección 3D por componente (clic en el modelo o aquí)
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  {pinDiagnostics.length} zonas monitoreadas
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {pinDiagnostics.map((p) => {
                  const active = selectedPin?.id === p.id;
                  const stateCls =
                    p.estado === 'Crítico'
                      ? 'text-rose-400'
                      : p.estado === 'Vigilancia'
                        ? 'text-amber-300'
                        : 'text-emerald-400';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPinId(p.id);
                        viewportRef.current?.focusComponent(p.id);
                      }}
                      className={`min-h-[44px] px-3 py-1.5 rounded-md border text-left shrink-0 transition-colors ${
                        active
                          ? 'bg-cyan-500/15 border-cyan-500/50 text-slate-100'
                          : 'bg-[#07090E] border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-medium whitespace-nowrap">{p.titulo}</div>
                      <div className={`text-[11px] font-mono tabular-nums ${stateCls}`}>
                        {p.desgastePct.toFixed(1)}% desgaste · {p.estado}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Panel de Configuración del Ensayo */}
          <aside className="lg:col-span-4 bg-[#0D121D] border border-slate-800 rounded-lg p-4 space-y-4 no-print">
            {/* Equipo y subida 3D */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  1. Modelo 3D del Hardware
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const payload = parseObjModel(SAMPLE_OBJ_ROVER, 'rover-prototipo.obj');
                    addCustomModel(payload, { nombre: 'Prototipo .OBJ Subido' });
                  }}
                  className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline"
                >
                  Probar .OBJ muestra
                </button>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                {hardwareCatalog.map((hw) => (
                  <button
                    key={hw.id}
                    type="button"
                    onClick={() => setSelectedHwId(hw.id)}
                    className={`min-h-[44px] px-3 py-2 rounded-md border text-left transition-colors ${
                      hw.id === activeHw.id
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200'
                        : 'bg-[#07090E] border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-semibold">{hw.nombre}</div>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                      {hw.masaKg} kg · Sellado {hw.selladoKpa} kPa
                    </div>
                  </button>
                ))}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".obj,.json"
                onChange={handleUploadFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[44px] px-3 py-2 text-xs font-medium bg-[#07090E] border border-dashed border-slate-700 hover:border-cyan-400 rounded-md text-slate-200 inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Upload className="w-4 h-4 text-cyan-400" />
                Subir modelo 3D propio (.OBJ o .JSON)
              </button>
              {uploadError && (
                <p className="text-[11px] text-rose-400">{uploadError}</p>
              )}
            </div>

            {/* Material y recubrimiento NASA */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <span className="block text-xs font-semibold text-slate-200">
                2. Material y Recubrimiento NASA
              </span>
              <div>
                <label htmlFor="select-mat-nasa" className="block text-[11px] text-slate-400 mb-1">
                  Aleación / Tejido base
                </label>
                <select
                  id="select-mat-nasa"
                  value={activeHw.material}
                  onChange={(e) =>
                    updateActiveHwField({ material: e.target.value as MaterialTipo })
                  }
                  className="w-full min-h-[44px] px-3 py-2 text-xs bg-[#07090E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-cyan-400"
                >
                  {Object.values(MATERIALES_INGENIERIA).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="select-coat-nasa" className="block text-[11px] text-slate-400 mb-1">
                  Recubrimiento superficial
                </label>
                <select
                  id="select-coat-nasa"
                  value={recubrimiento}
                  onChange={(e) => setRecubrimiento(e.target.value as RecubrimientoTipo)}
                  className="w-full min-h-[44px] px-3 py-2 text-xs bg-[#07090E] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-cyan-400"
                >
                  {Object.values(RECUBRIMIENTOS_NASA).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Zona de terreno */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="block text-xs font-semibold text-slate-200">
                3. Zona de Despliegue
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {ZONAS_DESPLIEGUE.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => setZonaId(z.id)}
                    className={`min-h-[44px] px-2.5 py-1.5 rounded-md border text-left text-[11px] font-medium transition-colors ${
                      z.id === zonaId
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                        : 'bg-[#07090E] border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {z.nombre.split('(')[0].trim()}
                  </button>
                ))}
              </div>
            </div>

            {/* Exposición en días */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">4. Tiempo de Exposición</span>
                <span className="font-mono tabular-nums text-cyan-300 font-bold">
                  {dias} días
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={730}
                value={dias}
                onChange={(e) => setDias(Number(e.target.value))}
                aria-label="Días de exposición"
                className="w-full accent-cyan-400"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  className="flex-1 min-h-[44px] px-3 py-2 text-xs font-semibold rounded-md bg-cyan-400 text-slate-950 hover:bg-cyan-300 inline-flex items-center justify-center gap-1.5"
                >
                  {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {playing ? 'Pausar línea' : 'Simular desgaste'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setDias(180);
                  }}
                  className="min-h-[44px] min-w-[44px] px-3 py-2 text-xs rounded-md bg-[#07090E] border border-slate-700 text-slate-300 hover:border-slate-500 inline-flex items-center justify-center"
                  title="Restablecer a 180 días"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </aside>
        </section>

        {/* Sector 3: Ficha del Componente 3D Seleccionado + KPIs + Curva */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Detalle del componente 3D + propiedades NASA del material */}
          <div className="lg:col-span-5 bg-[#0D121D] border border-slate-800 rounded-lg p-4 space-y-3 flex flex-col justify-between">
            {selectedPin && (
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-mono text-cyan-400 uppercase">
                      Pieza 3D seleccionada
                    </div>
                    <h2 className="text-sm font-bold text-slate-100">{selectedPin.titulo}</h2>
                    <p className="text-xs text-slate-400">{selectedPin.subtitulo}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-mono font-bold tabular-nums text-amber-300">
                      {selectedPin.desgastePct.toFixed(1)}%
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">{selectedPin.estado}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums pt-2 border-t border-slate-800">
                  <div className="p-2 rounded bg-[#07090E] border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Mecanismo dominante</span>
                    <span className="text-slate-100 font-sans font-medium">
                      {selectedPin.mecanismoDominante}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-[#07090E] border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Rango térmico local</span>
                    <span className="text-slate-100">
                      {selectedPin.tempMinK.toFixed(0)}–{selectedPin.tempMaxK.toFixed(0)} K
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[#07090E] border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  <span className="text-cyan-400 font-semibold">Mitigación NASA: </span>
                  {selectedPin.recomendacionNasa}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
              <div className="font-semibold text-slate-200">{matInfo.nombre}</div>
              <div className="font-mono tabular-nums text-[11px] text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                <span>Dureza {matInfo.durezaMohs} Mohs</span>
                <span>CTE {matInfo.ctePpmK} ppm/K</span>
                <span>Fluencia {matInfo.limiteFluenciaMpa} MPa</span>
                <span>Z_eff {matInfo.zEfectivo}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                {matInfo.referenciaNasa} · {coatInfo.referenciaNasa}
              </p>
            </div>
          </div>

          {/* 6 KPIs + Curva temporal en Canvas */}
          <div className="lg:col-span-7 bg-[#0D121D] border border-slate-800 rounded-lg p-4 space-y-3">
            {metrics.alertaCritica && (
              <div className="p-2.5 rounded bg-amber-950/50 border border-amber-600/40 text-xs text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>{metrics.alertaCritica}</span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono tabular-nums">
              <div className="p-2.5 rounded bg-[#07090E] border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">Integridad global</div>
                <div className="text-lg font-bold text-cyan-300">
                  {metrics.integridadGlobal.toFixed(1)}%
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#07090E] border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">Vida útil estimada</div>
                <div className="text-lg font-bold text-slate-100">
                  {metrics.vidaUtilEstimadaDias} d
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#07090E] border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">Abrasión regolito</div>
                <div className="text-lg font-bold text-amber-300">
                  {metrics.abrasionMecanica.toFixed(1)}%
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#07090E] border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">Fatiga térmica</div>
                <div className="text-lg font-bold text-rose-400">
                  {metrics.fatigaTermica.toFixed(1)}%
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#07090E] border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">Estrés de sellado</div>
                <div className="text-lg font-bold text-slate-200">
                  {metrics.estresPresion.toFixed(1)}%
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#07090E] border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">Radiación y polvo</div>
                <div className="text-lg font-bold text-purple-300">
                  {metrics.degradacionRadiacion.toFixed(1)}% / {metrics.obstruccionPolvo.toFixed(0)}%
                </div>
              </div>
            </div>

            <WearStripChartCanvas curva={curva} diaActual={dias} maxDias={730} />
          </div>
        </section>

        {/* Sector 4: Módulos de Ingeniería Avanzados y Análogo en la Tierra */}
        <section className="bg-[#0D121D] border border-slate-800 rounded-lg overflow-hidden">
          <div className="border-b border-slate-800 bg-[#0B0E17] px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-print">
            {(
              [
                { id: 'analogos', label: 'Análogos en Tierra', icon: Compass },
                { id: 'comparador', label: 'Comparador Aleaciones', icon: Layers },
                { id: 'radiacion', label: 'Blindaje g/cm²', icon: Shield },
                { id: 'ciclos', label: 'Fatiga Día–Noche', icon: Thermometer },
                { id: 'ficha', label: 'Ficha Técnica', icon: Download },
              ] as Array<{ id: StudioTabId; label: string; icon: React.ComponentType<{ className?: string }> }>
            ).map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-md whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-100 border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="p-4 sm:p-5">
            {activeTab === 'analogos' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      Mejores campos de prueba en la Tierra para {sitioDestino.nombre}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Calculado localmente comparando las 9 variables ambientales del laboratorio
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-[#07090E] p-1 rounded border border-slate-800 overflow-x-auto">
                    {(['rover', 'traje', 'base', 'equilibrado'] as PerfilRecomendacion[]).map(
                      (p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPerfilFiltro(p)}
                          className={`min-h-[36px] px-3 py-1 text-xs rounded capitalize whitespace-nowrap ${
                            perfilFiltro === p
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {recomendacionesTierra.map((rec, idx) => (
                    <div
                      key={rec.preset.id}
                      className="p-4 rounded-lg bg-[#07090E] border border-slate-800 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-amber-300 font-semibold">
                            #{idx + 1} RECOMENDADO
                          </span>
                          <span className="text-cyan-300 font-bold tabular-nums">
                            {rec.puntuacionPrueba.toFixed(1)}% aptitud
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-slate-100">
                          {rec.preset.nombre}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {rec.resumenIngenieria}
                        </p>
                        <div className="text-[11px] text-emerald-400">
                          Coincide mejor en: {rec.factoresFuertes.map((f) => f.etiqueta).join(', ')}
                        </div>
                        <div className="text-[11px] text-amber-300/90">
                          Compensar en cámara:{' '}
                          {rec.brechasACompensar.map((b) => b.etiqueta).join(', ')}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() =>
                            onApplyPairToApp(rec.preset, pdsEquivalente, 'canvas')
                          }
                          className="flex-1 min-h-[40px] px-3 py-1.5 text-xs font-medium bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 rounded hover:bg-cyan-500/30 inline-flex items-center justify-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Motor Canvas
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onApplyPairToApp(rec.preset, pdsEquivalente, 'laboratorio')
                          }
                          className="flex-1 min-h-[40px] px-3 py-1.5 text-xs font-medium bg-[#0D121D] border border-slate-700 text-slate-200 rounded hover:border-slate-500"
                        >
                          Instrumentos
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'comparador' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    Comparativa simultánea de los 5 materiales NASA en {sitioDestino.nombre} ({dias}{' '}
                    días)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Recubrimiento evaluado: {coatInfo.nombre} · Zona: {activeZona.nombre}
                  </p>
                </div>

                {/* Vista móvil en tarjetas limpias */}
                <div className="grid grid-cols-1 gap-2.5 md:hidden">
                  {alloyRows.map((row) => (
                    <div
                      key={row.material.id}
                      className="p-3 rounded bg-[#07090E] border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-100">
                          {row.material.nombre}
                        </span>
                        <span className="text-xs font-mono font-bold text-cyan-300 tabular-nums">
                          {row.integridadPct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono tabular-nums text-slate-400">
                        <span>Vida: {row.vidaUtilDias}d</span>
                        <span>Masa: {row.masaEstimadaKg}kg</span>
                        <span>Mohs: {row.material.durezaMohs}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">{row.material.notasFalla}</div>
                    </div>
                  ))}
                </div>

                {/* Tabla alineada en escritorio */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono">
                        <th className="py-2 pr-3">Material NASA</th>
                        <th className="py-2 px-3 text-right">Integridad</th>
                        <th className="py-2 px-3 text-right">Abrasión</th>
                        <th className="py-2 px-3 text-right">Térmica</th>
                        <th className="py-2 px-3 text-right">Radiación</th>
                        <th className="py-2 px-3 text-right">Vida útil</th>
                        <th className="py-2 px-3 text-right">Masa est.</th>
                        <th className="py-2 pl-3">Nota de falla</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {alloyRows.map((row) => (
                        <tr
                          key={row.material.id}
                          className={
                            row.material.id === activeHw.material ? 'bg-cyan-500/10' : ''
                          }
                        >
                          <td className="py-2.5 pr-3 font-medium text-slate-100">
                            {row.material.nombre}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-cyan-300">
                            {row.integridadPct.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-300">
                            {row.abrasionPct.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-300">
                            {row.termicaPct.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-purple-300">
                            {row.radiacionPct.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">
                            {row.vidaUtilDias} d
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                            {row.masaEstimadaKg} kg
                          </td>
                          <td className="py-2.5 pl-3 text-[11px] text-slate-400">
                            {row.material.notasFalla}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'radiacion' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-100">
                    Calculadora de Blindaje y Dosis (g/cm²)
                  </h3>
                  <div>
                    <label
                      htmlFor="shield-mat-select"
                      className="block text-[11px] text-slate-400 mb-1"
                    >
                      Material de escudo
                    </label>
                    <select
                      id="shield-mat-select"
                      value={shieldMaterial}
                      onChange={(e) => setShieldMaterial(e.target.value as BlindajeMaterialId)}
                      className="w-full min-h-[44px] px-3 py-2 text-xs bg-[#07090E] border border-slate-700 rounded-md text-slate-100"
                    >
                      {Object.values(BLINDAJES_RADIACION).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nombre} ({b.densidadGcm3} g/cm³)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Espesor del escudo</span>
                      <span className="font-mono tabular-nums text-cyan-300 font-semibold">
                        {shieldEspesorCm} cm ({shieldResult.arealDensityGcm2.toFixed(1)} g/cm²)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={0.5}
                      value={shieldEspesorCm}
                      onChange={(e) => setShieldEspesorCm(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {BLINDAJES_RADIACION[shieldMaterial].notaNasa}
                  </p>
                </div>

                <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono tabular-nums">
                  <div className="p-3 rounded bg-[#07090E] border border-slate-800">
                    <div className="text-[11px] font-sans text-slate-400">Densidad areal</div>
                    <div className="text-xl font-bold text-cyan-300">
                      {shieldResult.arealDensityGcm2.toFixed(1)}
                    </div>
                    <div className="text-[11px] text-slate-500">g/cm²</div>
                  </div>
                  <div className="p-3 rounded bg-[#07090E] border border-slate-800">
                    <div className="text-[11px] font-sans text-slate-400">Dosis atenuada</div>
                    <div className="text-xl font-bold text-slate-100">
                      {shieldResult.dosisAtenuadaMsvDia.toFixed(3)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      mSv/día (−{shieldResult.atenuacionPct.toFixed(0)}%)
                    </div>
                  </div>
                  <div className="p-3 rounded bg-[#07090E] border border-slate-800">
                    <div className="text-[11px] font-sans text-slate-400">
                      Dosis total ({dias}d)
                    </div>
                    <div className="text-xl font-bold text-amber-300">
                      {shieldResult.dosisTotalMisionMsv.toFixed(1)}
                    </div>
                    <div className="text-[11px] text-slate-500">mSv acumulados</div>
                  </div>
                  <div className="col-span-2 sm:col-span-3 p-3 rounded bg-[#07090E] border border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-sans">
                      <span className="text-slate-300">
                        Relación con límite de carrera NASA (600 mSv)
                      </span>
                      <span className="font-mono text-cyan-300 font-bold">
                        {shieldResult.fraccionLimiteNasa600MsvPct.toFixed(1)}% ·{' '}
                        {shieldResult.nivelSeguridadTripulacion}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-900 rounded overflow-hidden border border-slate-800">
                      <div
                        className={`h-full ${
                          shieldResult.fraccionLimiteNasa600MsvPct > 100
                            ? 'bg-rose-500'
                            : shieldResult.fraccionLimiteNasa600MsvPct > 45
                              ? 'bg-amber-400'
                              : 'bg-cyan-400'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(2, shieldResult.fraccionLimiteNasa600MsvPct))}%`,
                        }}
                      />
                    </div>
                    <div className="text-[11px] font-sans text-slate-400">
                      Riesgo en electrónica de vuelo: {shieldResult.riesgoElectronica}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ciclos' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      Simulador Extendido de Fatiga Día–Noche (Modelo Coffin-Manson)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Salto térmico por ciclo local: ΔT = {cycleSim.deltaTCicloK.toFixed(0)} K · Vida
                      estimada (50% integridad):{' '}
                      <span className="font-mono text-cyan-300 font-semibold">
                        {cycleSim.ciclosHastaFalla50} ciclos
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Horizonte:</span>
                    {[250, 500, 1000, 2000].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setMaxCiclosSim(c)}
                        className={`min-h-[36px] px-2.5 py-1 rounded font-mono border ${
                          maxCiclosSim === c
                            ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                            : 'bg-[#07090E] border-slate-800 text-slate-400'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <ThermalCycleCanvas puntos={cycleSim.puntos} maxCiclos={maxCiclosSim} />
              </div>
            )}

            {activeTab === 'ficha' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      Ficha Técnica Exportable del Ensayo
                    </h3>
                    <p className="text-xs text-slate-400">
                      Compila modelo 3D, datos del laboratorio, blindaje y análogo terrestre en JSON o
                      PDF imprimible.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const url = viewportRef.current?.captureSnapshot() ?? null;
                        setSnapshotUrl(url);
                      }}
                      className="min-h-[44px] px-3 py-2 text-xs font-medium bg-[#07090E] border border-slate-700 hover:border-cyan-400 rounded-md text-slate-200 inline-flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      Capturar vista 3D
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadJsonReport}
                      className="min-h-[44px] px-3 py-2 text-xs font-medium bg-[#07090E] border border-slate-700 hover:border-cyan-400 rounded-md text-slate-200 inline-flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4 text-cyan-400" />
                      Descargar JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-md inline-flex items-center gap-1.5"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir / PDF
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-[#07090E] border border-slate-800 space-y-3 text-xs">
                  {snapshotUrl && (
                    <img
                      src={snapshotUrl}
                      alt="Captura del modelo 3D bajo prueba de desgaste"
                      className="w-full max-w-md rounded border border-slate-700"
                    />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono tabular-nums">
                    <div>
                      <span className="text-slate-400 block font-sans">Sitio y zona</span>
                      <span className="text-slate-100">
                        {sitioDestino.nombre} · {activeZona.nombre}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans">Equipo y material</span>
                      <span className="text-slate-100">
                        {activeHw.nombre} ({matInfo.nombre})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans">Integridad tras {dias} días</span>
                      <span className="text-cyan-300 font-bold">
                        {metrics.integridadGlobal.toFixed(1)}% (Vida útil {metrics.vidaUtilEstimadaDias} d)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans">Análogo terrestre #1</span>
                      <span className="text-amber-300">
                        {recomendacionesTierra[0]?.preset.nombre ?? 'N/D'} (
                        {recomendacionesTierra[0]?.puntuacionPrueba.toFixed(1) ?? '—'}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
