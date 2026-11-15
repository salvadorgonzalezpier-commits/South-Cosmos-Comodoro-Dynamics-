import { SitioAmbiental } from './analogo';

export type HardwareAssetKind = 'rover' | 'traje' | 'base' | 'custom';

export type MaterialTipo =
  | 'al7075'
  | 'ti6al4v'
  | 'vectran'
  | 'basalto_cfrp'
  | 'inox316l';

export type ZonaDespliegueId =
  | 'planicie'
  | 'ladera'
  | 'crater_sombra'
  | 'cresta_solar';

export type WearVisualMode = 'fisico' | 'termico' | 'mecanico' | 'radiacion';

export type RecubrimientoTipo =
  | 'ninguno'
  | 'anodizado_duro'
  | 'hbn_ceramico'
  | 'ptfe_poliimida'
  | 'pintura_z93';

export interface RecubrimientoSpec {
  id: RecubrimientoTipo;
  nombre: string;
  multAbrasion: number;
  multPolvo: number;
  multTermica: number;
  multRadiacion: number;
  espesorUm: number;
  referenciaNasa: string;
}

export const RECUBRIMIENTOS_NASA: Record<RecubrimientoTipo, RecubrimientoSpec> = {
  ninguno: {
    id: 'ninguno',
    nombre: 'Sin recubrimiento (sustrato desnudo)',
    multAbrasion: 1.0,
    multPolvo: 1.0,
    multTermica: 1.0,
    multRadiacion: 1.0,
    espesorUm: 0,
    referenciaNasa: 'Línea base sin barrera tribológica',
  },
  anodizado_duro: {
    id: 'anodizado_duro',
    nombre: 'Anodizado Duro Tipo III (MIL-A-8625)',
    multAbrasion: 1.42,
    multPolvo: 1.15,
    multTermica: 1.1,
    multRadiacion: 1.05,
    espesorUm: 50,
    referenciaNasa: 'NASA Mars Rover / Chasis Al endurecido',
  },
  hbn_ceramico: {
    id: 'hbn_ceramico',
    nombre: 'Plasma Spray Cerámico hBN Anti-Polvo',
    multAbrasion: 1.65,
    multPolvo: 1.7,
    multTermica: 1.25,
    multRadiacion: 1.12,
    espesorUm: 85,
    referenciaNasa: 'NASA GRC / JPL mitigación de galling en Ti-6Al-4V',
  },
  ptfe_poliimida: {
    id: 'ptfe_poliimida',
    nombre: 'Film PTFE / Poliimida Kapton (EVA)',
    multAbrasion: 1.38,
    multPolvo: 1.55,
    multTermica: 1.32,
    multRadiacion: 1.18,
    espesorUm: 120,
    referenciaNasa: 'NASA Artemis xEMU protección contra partículas <20 µm',
  },
  pintura_z93: {
    id: 'pintura_z93',
    nombre: 'Recubrimiento Térmico Z93 / AZ-93',
    multAbrasion: 1.18,
    multPolvo: 1.25,
    multTermica: 1.52,
    multRadiacion: 1.2,
    espesorUm: 130,
    referenciaNasa: 'NASA MSFC control térmico α/ε = 0.16 / 0.91',
  },
};

export interface MaterialSpec {
  id: MaterialTipo;
  nombre: string;
  resistenciaAbrasiva: number;
  resistenciaTermica: number;
  resistenciaRadiacion: number;
  resistenciaSellado: number;
  masaDensidadRel: number;
  durezaMohs: number;
  ctePpmK: number;
  limiteFluenciaMpa: number;
  densidadGcm3: number;
  zEfectivo: number;
  referenciaNasa: string;
  notasFalla: string;
}

export const MATERIALES_INGENIERIA: Record<MaterialTipo, MaterialSpec> = {
  al7075: {
    id: 'al7075',
    nombre: 'Aluminio Aeroespacial 7075-T6',
    resistenciaAbrasiva: 0.95,
    resistenciaTermica: 1.0,
    resistenciaRadiacion: 0.9,
    resistenciaSellado: 1.05,
    masaDensidadRel: 1.0,
    durezaMohs: 3.8,
    ctePpmK: 23.6,
    limiteFluenciaMpa: 503,
    densidadGcm3: 2.81,
    zEfectivo: 13.0,
    referenciaNasa: 'NTRS: desgaste abrasivo 3-cuerpos frente a regolito (~7 Mohs)',
    notasFalla: 'Blando frente a plagioclasa/sílice lunar; requiere anodizado duro.',
  },
  ti6al4v: {
    id: 'ti6al4v',
    nombre: 'Aleación Titanio Ti-6Al-4V',
    resistenciaAbrasiva: 1.45,
    resistenciaTermica: 1.4,
    resistenciaRadiacion: 1.25,
    resistenciaSellado: 1.35,
    masaDensidadRel: 1.3,
    durezaMohs: 6.0,
    ctePpmK: 8.6,
    limiteFluenciaMpa: 880,
    densidadGcm3: 4.43,
    zEfectivo: 21.2,
    referenciaNasa: 'NASA JPL / Perseverance: baja expansión térmica y alta tenacidad',
    notasFalla: 'Riesgo de gripado (galling) en vacío si entra polvo fino sin hBN.',
  },
  vectran: {
    id: 'vectran',
    nombre: 'Multicapa Vectran LCP / Kevlar MLI',
    resistenciaAbrasiva: 1.15,
    resistenciaTermica: 1.3,
    resistenciaRadiacion: 0.8,
    resistenciaSellado: 1.2,
    masaDensidadRel: 0.65,
    durezaMohs: 2.5,
    ctePpmK: -4.0,
    limiteFluenciaMpa: 2900,
    densidadGcm3: 1.41,
    zEfectivo: 6.2,
    referenciaNasa: 'NASA Artemis EVA: rotura de coronas del tejido ante regolito angular',
    notasFalla: 'Atrapamiento de polvo <20 µm en el trenzado; exige lámina PTFE.',
  },
  basalto_cfrp: {
    id: 'basalto_cfrp',
    nombre: 'Compuesto CFRP + Regolito Sinterizado',
    resistenciaAbrasiva: 1.35,
    resistenciaTermica: 1.25,
    resistenciaRadiacion: 1.55,
    resistenciaSellado: 1.15,
    masaDensidadRel: 1.1,
    durezaMohs: 6.5,
    ctePpmK: 3.2,
    limiteFluenciaMpa: 620,
    densidadGcm3: 1.85,
    zEfectivo: 9.8,
    referenciaNasa: 'NASA NiAC / Hábitats ISRU: bajo Z efectivo reduce Bremsstrahlung',
    notasFalla: 'Delaminación de matriz epoxi tras >400 ciclos extremos ΔT > 180 K.',
  },
  inox316l: {
    id: 'inox316l',
    nombre: 'Acero Criogénico Inox 316L',
    resistenciaAbrasiva: 1.3,
    resistenciaTermica: 1.35,
    resistenciaRadiacion: 1.4,
    resistenciaSellado: 1.3,
    masaDensidadRel: 1.75,
    durezaMohs: 5.5,
    ctePpmK: 16.0,
    limiteFluenciaMpa: 290,
    densidadGcm3: 7.99,
    zEfectivo: 25.8,
    referenciaNasa: 'NASA Cryo Testbed: ductilidad mantenida bajo 100 K',
    notasFalla: 'Alta penalización de masa y mayor radiación secundaria por alto Z.',
  },
};

export interface CustomModelPayload {
  format: 'obj' | 'json' | 'image' | 'gltf' | 'stl';
  fileName: string;
  vertices?: Array<[number, number, number]>;
  faces?: Array<[number, number, number]>;
  poligonos2d?: Array<{ points: Array<[number, number]>; color?: string }>;
  imageEl?: HTMLImageElement;
  imageDataUrl?: string;
  rawText?: string;
  binaryBuffer?: ArrayBuffer;
}

export interface HardwareSpec {
  id: string;
  nombre: string;
  tipo: HardwareAssetKind;
  descripcion: string;
  material: MaterialTipo;
  masaKg: number;
  selladoKpa: number;
  tempMinK: number;
  tempMaxK: number;
  blindajeBase: number;
  anchoRel: number;
  altoRel: number;
  customModel?: CustomModelPayload;
}

export const PRESET_HARDWARE_SPECS: HardwareSpec[] = [
  {
    id: 'rover-6x6',
    nombre: 'Rover 6x6 Explorador (Clase Perseverance)',
    tipo: 'rover',
    descripcion:
      'Chasis con suspensión rocker-bogie, 6 ruedas metálicas dentadas, brazo muestreador y mástil óptico.',
    material: 'ti6al4v',
    masaKg: 980,
    selladoKpa: 12,
    tempMinK: 155,
    tempMaxK: 375,
    blindajeBase: 1.25,
    anchoRel: 1.15,
    altoRel: 0.78,
  },
  {
    id: 'traje-eva',
    nombre: 'Traje Espacial EVA (AxEMU / Superficie)',
    tipo: 'traje',
    descripcion:
      'Traje presurizado con visor áureo antirradiación, mochila PLSS, juntas rotatorias y botas anti-regolito.',
    material: 'vectran',
    masaKg: 128,
    selladoKpa: 30,
    tempMinK: 125,
    tempMaxK: 390,
    blindajeBase: 0.85,
    anchoRel: 0.52,
    altoRel: 1.05,
  },
  {
    id: 'base-permanente',
    nombre: 'Base Permanente (Hábitat Domo + Esclusa)',
    tipo: 'base',
    descripcion:
      'Módulo presurizado a 70 kPa con escudo térmico multicapa, radiadores laterales y arreglo solar.',
    material: 'basalto_cfrp',
    masaKg: 14500,
    selladoKpa: 70,
    tempMinK: 95,
    tempMaxK: 400,
    blindajeBase: 1.75,
    anchoRel: 1.55,
    altoRel: 0.92,
  },
];

export interface ZonaDespliegue {
  id: ZonaDespliegueId;
  nombre: string;
  resumen: string;
  xNorm: number;
  multPendiente: number;
  multRugosidad: number;
  multViento: number;
  multLuz: number;
  multRadiacion: number;
  deltaTempK: number;
}

export const ZONAS_DESPLIEGUE: ZonaDespliegue[] = [
  {
    id: 'planicie',
    nombre: 'Planicie Basal (Referencia)',
    resumen: 'Terreno uniforme con exposición ambiental nominal del sitio.',
    xNorm: 0.22,
    multPendiente: 1.0,
    multRugosidad: 1.0,
    multViento: 1.0,
    multLuz: 1.0,
    multRadiacion: 1.0,
    deltaTempK: 0,
  },
  {
    id: 'ladera',
    nombre: 'Ladera Rocosa / Borde de Cráter',
    resumen: 'Alta pendiente y regolito grueso: acelera fatiga en ruedas, botas y anclajes.',
    xNorm: 0.45,
    multPendiente: 2.1,
    multRugosidad: 1.95,
    multViento: 1.15,
    multLuz: 0.95,
    multRadiacion: 1.05,
    deltaTempK: -4,
  },
  {
    id: 'crater_sombra',
    nombre: 'Sombra Permanente / Tubo de Lava',
    resumen: 'Menor viento y radiación solar, pero choque criogénico severo.',
    xNorm: 0.67,
    multPendiente: 1.25,
    multRugosidad: 1.35,
    multViento: 0.35,
    multLuz: 0.18,
    multRadiacion: 0.45,
    deltaTempK: -52,
  },
  {
    id: 'cresta_solar',
    nombre: 'Cresta Elevada / Pico de Luz',
    resumen: 'Máxima energía solar (W/m²), pero vientos fuertes y radiación cósmica plena.',
    xNorm: 0.85,
    multPendiente: 1.35,
    multRugosidad: 1.2,
    multViento: 1.45,
    multLuz: 1.28,
    multRadiacion: 1.35,
    deltaTempK: 14,
  },
];

export interface WearMetricsSnapshot {
  dias: number;
  integridadGlobal: number;
  abrasionMecanica: number;
  fatigaTermica: number;
  estresPresion: number;
  degradacionRadiacion: number;
  obstruccionPolvo: number;
  vidaUtilEstimadaDias: number;
  tMaxLocalK: number;
  tMinLocalK: number;
  alertaCritica: string | null;
}

export interface WearCurvePoint {
  dia: number;
  integridad: number;
  abrasion: number;
  termica: number;
  radiacion: number;
}

export interface LabTelemetryBridge {
  sitioTierra: SitioAmbiental;
  sitioMarte: SitioAmbiental;
  sitioLuna: SitioAmbiental;
  sitioActivoA: SitioAmbiental;
  sitioActivoB: SitioAmbiental;
  similitudTotalPct: number;
  usaNasaEnVivo: boolean;
  earthLat: number;
  earthLon: number;
  earthStartDate: string;
  earthEndDate: string;
  proyeccionMarteActiva: boolean;
  proyeccionLunaActiva: boolean;
  proyeccionTierraActiva: boolean;
}

export interface ComponentPinDiagnostic {
  id: string;
  titulo: string;
  subtitulo: string;
  anchor: [number, number, number];
  desgastePct: number;
  abrasionPct: number;
  termicaPct: number;
  radiacionPct: number;
  polvoPct: number;
  mecanismoDominante: string;
  estado: 'Nominal' | 'Vigilancia' | 'Crítico';
  tempMinK: number;
  tempMaxK: number;
  recomendacionNasa: string;
}

export interface AlloyComparisonRow {
  material: MaterialSpec;
  integridadPct: number;
  abrasionPct: number;
  termicaPct: number;
  radiacionPct: number;
  vidaUtilDias: number;
  masaEstimadaKg: number;
  estado: 'Óptimo' | 'Apto' | 'Riesgo';
}

export type BlindajeMaterialId = 'polietileno' | 'agua' | 'aluminio' | 'regolito';

export interface RadiationShieldSpec {
  id: BlindajeMaterialId;
  nombre: string;
  densidadGcm3: number;
  zMedio: number;
  factorAtenuacionGcr: number;
  factorSecundario: number;
  notaNasa: string;
}

export const BLINDAJES_RADIACION: Record<BlindajeMaterialId, RadiationShieldSpec> = {
  polietileno: {
    id: 'polietileno',
    nombre: 'Polietileno Alta Densidad (HDPE)',
    densidadGcm3: 0.96,
    zMedio: 4.3,
    factorAtenuacionGcr: 1.38,
    factorSecundario: 0.04,
    notaNasa: 'Estándar ISS / Orion: máximo hidrógeno por unidad de masa; mínima radiación secundaria.',
  },
  agua: {
    id: 'agua',
    nombre: 'Pared Hidrógena / Agua Potable',
    densidadGcm3: 1.0,
    zMedio: 4.8,
    factorAtenuacionGcr: 1.32,
    factorSecundario: 0.05,
    notaNasa: 'Doble uso en hábitats: reserva vital + barrera eficiente contra protones solares (SPE).',
  },
  aluminio: {
    id: 'aluminio',
    nombre: 'Blindaje Estructural Aluminio 7075',
    densidadGcm3: 2.81,
    zMedio: 13.0,
    factorAtenuacionGcr: 0.85,
    factorSecundario: 0.22,
    notaNasa: 'Bueno para SPE con >10 g/cm², pero genera neutrones secundarios ante GCR pesados.',
  },
  regolito: {
    id: 'regolito',
    nombre: 'Regolito Compactado ISRU (In-Situ)',
    densidadGcm3: 1.75,
    zMedio: 10.6,
    factorAtenuacionGcr: 1.02,
    factorSecundario: 0.11,
    notaNasa: 'NASA Artemis: 30–50 g/cm² (18–30 cm) reducen dosis crónica a niveles seguros sin masa lanzada.',
  },
};

export interface RadiationShieldResult {
  arealDensityGcm2: number;
  dosisSinBlindajeMsvDia: number;
  dosisAtenuadaMsvDia: number;
  dosisTotalMisionMsv: number;
  atenuacionPct: number;
  fraccionLimiteNasa600MsvPct: number;
  riesgoElectronica: 'Bajo' | 'Moderado' | 'Alto';
  nivelSeguridadTripulacion: 'Seguro' | 'Controlado' | 'Excede Límite NASA';
}

export interface ThermalCyclePoint {
  ciclo: number;
  integridadEstructural: number;
  fatigaSellos: number;
  retencionPotencia: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function calcularDesgasteEnDia(
  sitio: SitioAmbiental,
  hardware: HardwareSpec,
  zona: ZonaDespliegue,
  dias: number,
  recubrimiento: RecubrimientoTipo = 'ninguno'
): WearMetricsSnapshot {
  const mat = MATERIALES_INGENIERIA[hardware.material];
  const coat = RECUBRIMIENTOS_NASA[recubrimiento] ?? RECUBRIMIENTOS_NASA.ninguno;
  const d = Math.max(0, dias);

  const pendEff = Math.min(45, sitio.pendiente * zona.multPendiente);
  const rugEff = sitio.rugosidad * zona.multRugosidad;
  const vientoEff = sitio.viento[0] * zona.multViento;
  const luzEff = sitio.luz[0] * zona.multLuz;
  const radEff = sitio.radiacion * zona.multRadiacion;

  const tBaseLocal = sitio.T[0] + zona.deltaTempK;
  const tAmpLocal = sitio.T[1] * (zona.id === 'crater_sombra' ? 0.35 : 1.0);
  const tMaxLocalK = tBaseLocal + tAmpLocal;
  const tMinLocalK = Math.max(30, tBaseLocal - tAmpLocal);

  const factorTipoAbras =
    hardware.tipo === 'rover'
      ? 1.25
      : hardware.tipo === 'traje'
        ? 1.45
        : hardware.tipo === 'base'
          ? 0.55
          : 1.0;

  // Dureza de regolito (SiO2/Fe2O3 ~ 7 Mohs) comparada con dureza del material
  const durezaSuelo = (sitio.suelo.SiO2 ?? 0.45) * 1.15 + (sitio.suelo.Fe2O3 ?? 0.1) * 1.4;
  const penalMohs = clamp(6.8 / Math.max(2.0, mat.durezaMohs), 0.85, 2.1);

  const tasaAbrasionDia =
    ((0.024 + rugEff * 2.0 + (pendEff / 45) * 0.18 + vientoEff * 0.012) *
      durezaSuelo *
      penalMohs *
      factorTipoAbras) /
    (mat.resistenciaAbrasiva * coat.multAbrasion);

  const deltaT = 2 * tAmpLocal;
  const ciclosPorDia = Math.max(0.03, 24 / Math.max(1, sitio.periodo));
  const excesoFrio = Math.max(0, hardware.tempMinK - tMinLocalK);
  const excesoCalor = Math.max(0, tMaxLocalK - hardware.tempMaxK);
  const choqueLimite = (excesoFrio + excesoCalor) * 0.0085;
  const cteFactor = 0.85 + Math.abs(mat.ctePpmK) / 60;

  const tasaTermicaDia =
    ((0.012 + (deltaT / 220) * 0.24 * Math.pow(ciclosPorDia, 0.45) * cteFactor + choqueLimite) *
      (hardware.tipo === 'traje' ? 1.35 : hardware.tipo === 'base' ? 0.72 : 1.0)) /
    (mat.resistenciaTermica * coat.multTermica);

  const pExtKpa = Math.max(0, sitio.P[0] / 1000);
  const deltaPKpa = Math.abs(hardware.selladoKpa - pExtKpa);
  const factorVacio = pExtKpa < 0.05 ? 1.45 : 1.0;
  const tasaPresionDia =
    ((0.008 + (deltaPKpa / 101.3) * 0.085 * factorVacio) *
      (hardware.tipo === 'traje' ? 1.5 : hardware.tipo === 'base' ? 1.15 : 0.7)) /
    mat.resistenciaSellado;

  const tasaRadDia =
    ((0.005 + (radEff / 60) * 0.16 + (luzEff / 1361) * 0.035) *
      (hardware.tipo === 'traje' ? 1.2 : hardware.tipo === 'base' ? 0.65 : 1.0)) /
    (mat.resistenciaRadiacion * coat.multRadiacion * hardware.blindajeBase);

  const cargaElectrostatica = pExtKpa < 0.01 ? (luzEff / 1361) * 0.14 : 0;
  const tasaPolvoDia =
    ((0.01 + vientoEff * 0.022 + cargaElectrostatica + (sitio.suelo.Fe2O3 ?? 0.1) * 0.08) *
      (hardware.tipo === 'base' ? 0.85 : 1.1)) /
    coat.multPolvo;

  const abrasionMecanica = clamp(100 * (1 - Math.exp(-tasaAbrasionDia * d * 0.03)), 0, 100);
  const fatigaTermica = clamp(100 * (1 - Math.exp(-tasaTermicaDia * d * 0.03)), 0, 100);
  const estresPresion = clamp(100 * (1 - Math.exp(-tasaPresionDia * d * 0.028)), 0, 100);
  const degradacionRadiacion = clamp(100 * (1 - Math.exp(-tasaRadDia * d * 0.028)), 0, 100);
  const obstruccionPolvo = clamp(100 * (1 - Math.exp(-tasaPolvoDia * d * 0.025)), 0, 100);

  const desgastePonderado =
    0.26 * abrasionMecanica +
    0.28 * fatigaTermica +
    0.18 * estresPresion +
    0.16 * degradacionRadiacion +
    0.12 * obstruccionPolvo;

  const integridadGlobal = clamp(100 - desgastePonderado, 0, 100);

  const tasaCombinadaDia =
    0.26 * tasaAbrasionDia * 0.03 +
    0.28 * tasaTermicaDia * 0.03 +
    0.18 * tasaPresionDia * 0.028 +
    0.16 * tasaRadDia * 0.028 +
    0.12 * tasaPolvoDia * 0.025;

  const vidaUtilEstimadaDias = Math.round(
    clamp(0.916 / Math.max(1e-5, tasaCombinadaDia), 5, 3650)
  );

  let alertaCritica: string | null = null;
  if (excesoFrio > 0) {
    alertaCritica = `Temperatura mínima (${tMinLocalK.toFixed(0)} K) por debajo del límite operativo (${hardware.tempMinK} K)`;
  } else if (excesoCalor > 0) {
    alertaCritica = `Temperatura máxima (${tMaxLocalK.toFixed(0)} K) supera tolerancia térmica (${hardware.tempMaxK} K)`;
  } else if (integridadGlobal < 45) {
    alertaCritica = `Integridad bajo umbral crítico (${integridadGlobal.toFixed(1)}%): sustituir módulo o aplicar recubrimiento`;
  }

  return {
    dias: d,
    integridadGlobal,
    abrasionMecanica,
    fatigaTermica,
    estresPresion,
    degradacionRadiacion,
    obstruccionPolvo,
    vidaUtilEstimadaDias,
    tMaxLocalK,
    tMinLocalK,
    alertaCritica,
  };
}

export function simularCurvaDesgaste(
  sitio: SitioAmbiental,
  hardware: HardwareSpec,
  zona: ZonaDespliegue,
  maxDias = 730,
  pasos = 60,
  recubrimiento: RecubrimientoTipo = 'ninguno'
): WearCurvePoint[] {
  const out: WearCurvePoint[] = [];
  for (let i = 0; i <= pasos; i++) {
    const dia = Math.round((i / pasos) * maxDias);
    const snap = calcularDesgasteEnDia(sitio, hardware, zona, dia, recubrimiento);
    out.push({
      dia,
      integridad: snap.integridadGlobal,
      abrasion: snap.abrasionMecanica,
      termica: snap.fatigaTermica,
      radiacion: snap.degradacionRadiacion,
    });
  }
  return out;
}

export function diagnosticarComponentesHardware(
  sitio: SitioAmbiental,
  hardware: HardwareSpec,
  zona: ZonaDespliegue,
  dias: number,
  recubrimiento: RecubrimientoTipo = 'ninguno'
): ComponentPinDiagnostic[] {
  const base = calcularDesgasteEnDia(sitio, hardware, zona, dias, recubrimiento);

  const buildPin = (
    id: string,
    titulo: string,
    subtitulo: string,
    anchor: [number, number, number],
    weights: { abr: number; ter: number; rad: number; pol: number },
    recText: string
  ): ComponentPinDiagnostic => {
    const abr = clamp(base.abrasionMecanica * weights.abr, 0, 100);
    const ter = clamp(base.fatigaTermica * weights.ter, 0, 100);
    const rad = clamp(base.degradacionRadiacion * weights.rad, 0, 100);
    const pol = clamp(base.obstruccionPolvo * weights.pol, 0, 100);
    const total = clamp(0.32 * abr + 0.30 * ter + 0.22 * rad + 0.16 * pol, 0, 100);

    const pares: Array<[string, number]> = [
      ['Abrasión por regolito', abr],
      ['Choque / fatiga térmica', ter],
      ['Radiación ionizante / UV', rad],
      ['Adhesión electrostática de polvo', pol],
    ];
    pares.sort((a, b) => b[1] - a[1]);

    const estado: ComponentPinDiagnostic['estado'] =
      total >= 55 ? 'Crítico' : total >= 28 ? 'Vigilancia' : 'Nominal';

    return {
      id,
      titulo,
      subtitulo,
      anchor,
      desgastePct: total,
      abrasionPct: abr,
      termicaPct: ter,
      radiacionPct: rad,
      polvoPct: pol,
      mecanismoDominante: pares[0][0],
      estado,
      tempMinK: base.tMinLocalK - (weights.ter > 1.05 ? 6 : 0),
      tempMaxK: base.tMaxLocalK + (weights.rad > 1.05 ? 9 : 0),
      recomendacionNasa: recText,
    };
  };

  if (hardware.tipo === 'rover') {
    return [
      buildPin(
        'ruedas',
        'Ruedas y Suspensión Rocker-Bogie',
        'Contacto directo con basalto/sílice y pendiente',
        [0.95, 0.28, 0.88],
        { abr: 1.45, ter: 0.9, rad: 0.55, pol: 1.15 },
        'Usar banda de rodadura en Ti-6Al-4V con garras helicoidales y sin nervaduras delgadas de aluminio.'
      ),
      buildPin(
        'juntas',
        'Actuadores y Sellos Rotatorios',
        'Cojinetes de dirección y muñeca del brazo',
        [-0.85, 0.42, 0.72],
        { abr: 1.25, ter: 1.15, rad: 0.65, pol: 1.38 },
        'Aplicar recubrimiento hBN cerámico + fuelles de PTFE para evitar gripado por polvo <20 µm.'
      ),
      buildPin(
        'chasis',
        'Chasis WEB y Caja Electrónica',
        'Aislamiento térmico multicapa y radiadores',
        [0.0, 0.68, 0.0],
        { abr: 0.55, ter: 1.22, rad: 1.15, pol: 0.8 },
        'Mantener recubrimiento blanco Z93 limpio y blindaje local de Al/HDPE en computadoras de vuelo.'
      ),
      buildPin(
        'paneles',
        'Cubierta Energética / Radiadores',
        'Exposición directa solar, UV y caída de polvo',
        [0.0, 0.85, -0.78],
        { abr: 0.65, ter: 1.28, rad: 1.35, pol: 1.42 },
        'Incluir escudos electrostáticos de polvo (EDS) o inclinación periódica para recuperación energética.'
      ),
      buildPin(
        'mastil',
        'Mástil Óptico y Antena HGA',
        'Lentes, sensores y cardán de puntería',
        [0.58, 1.45, 0.45],
        { abr: 0.48, ter: 1.18, rad: 1.32, pol: 1.1 },
        'Integrar ventanas de zafiro antirreflejo con cobertura retráctil durante tormentas de polvo.'
      ),
    ];
  }

  if (hardware.tipo === 'traje') {
    return [
      buildPin(
        'botas',
        'Botas y Suela Anti-Regolito',
        'Fricción continua con regolito angular',
        [0.24, 0.14, 0.12],
        { abr: 1.5, ter: 1.05, rad: 0.45, pol: 1.3 },
        'Suela reforzada en elastómero fluorado y puntera polimérica reemplazable tras cada EVA.'
      ),
      buildPin(
        'juntas_traje',
        'Cojinetes de Rodilla y Hombro',
        'Sellos presurizados a 30 kPa en movimiento',
        [-0.36, 1.05, 0.14],
        { abr: 1.3, ter: 1.15, rad: 0.6, pol: 1.48 },
        'Doble sello lip-seal con barrera antipolvo PTFE según arquitectura NASA Artemis xEMU.'
      ),
      buildPin(
        'torso',
        'Capa Exterior Vectran / Kevlar',
        'Resistencia al corte y aislamiento MLI',
        [0.0, 1.22, 0.22],
        { abr: 1.12, ter: 1.24, rad: 1.05, pol: 1.2 },
        'Laminar el tejido Vectran con film protector externo para evitar abrasión en coronas del hilo.'
      ),
      buildPin(
        'visor',
        'Casco y Visor Áureo UV/IR',
        'Impacto térmico solar y rayado por polvo',
        [0.0, 1.72, 0.26],
        { abr: 0.85, ter: 1.25, rad: 1.45, pol: 1.25 },
        'Usar visor sacrificable exterior removible para preservar el recubrimiento reflector de oro.'
      ),
      buildPin(
        'plss',
        'Mochila PLSS y Sublimador Térmico',
        'Disipación térmica y válvulas de oxígeno',
        [0.0, 1.28, -0.32],
        { abr: 0.55, ter: 1.18, rad: 1.22, pol: 0.9 },
        'Cubrir carcasas con pintura blanca Z93 y blindaje interno HDPE en controladores de soporte vital.'
      ),
    ];
  }

  if (hardware.tipo === 'base') {
    return [
      buildPin(
        'cimentacion',
        'Anclajes y Bermas de Regolito',
        'Cargas gravitacionales y erosión basal',
        [1.1, 0.15, 0.9],
        { abr: 1.3, ter: 0.85, rad: 0.4, pol: 1.05 },
        'Compactar bermas de regolito sinterizado (CFRP/ISRU) para estabilizar pendiente y mitigar abrasión.'
      ),
      buildPin(
        'esclusa',
        'Esclusa Presurizada (70 kPa) y Sellos',
        'Ciclos diarios de entrada y salida de polvo',
        [0.0, 0.45, 1.28],
        { abr: 1.22, ter: 1.1, rad: 0.75, pol: 1.55 },
        'Implementar cámara de descontaminación electrostática (suitport) antes del volumen habitable.'
      ),
      buildPin(
        'domo',
        'Cúpula Estructural y Blindaje',
        'Estabilidad frente a radiación crónica y ΔT',
        [0.0, 1.18, 0.0],
        { abr: 0.65, ter: 1.28, rad: 1.35, pol: 0.85 },
        'Añadir ≥30 g/cm² de regolito sobre la bóveda para atenuar dosis GCR/SPE en misiones largas.'
      ),
      buildPin(
        'paneles_base',
        'Arreglo Solar y Alas Radiadoras',
        'Suciedad atmosférica y choque térmico',
        [-1.45, 0.78, -0.3],
        { abr: 0.72, ter: 1.3, rad: 1.38, pol: 1.4 },
        'Separar radiadores verticales en ángulo bajo y proteger paneles con recubrimiento antiestático.'
      ),
      buildPin(
        'comunicaciones',
        'Torre de Antenas y Telemetría',
        'Exposición plena al viento y tormentas',
        [0.45, 1.65, -0.65],
        { abr: 0.85, ter: 1.15, rad: 1.3, pol: 1.05 },
        'Reforzar empotramiento de mástil contra ráfagas de cresta y sellar conectores coaxiales.'
      ),
    ];
  }

  return [
    buildPin(
      'base_contacto',
      'Zona Basal en Contacto con Terreno',
      'Abrasión y soporte mecánico sobre regolito',
      [0.0, 0.18, 0.65],
      { abr: 1.4, ter: 0.95, rad: 0.7, pol: 1.25 },
      'Reforzar la superficie inferior contra desgaste tribológico por partículas angulares.'
    ),
    buildPin(
      'estructura_central',
      'Núcleo Estructural del Modelo',
      'Expansión térmica y diferencial de presión',
      [0.0, 0.65, 0.0],
      { abr: 0.8, ter: 1.25, rad: 1.05, pol: 0.9 },
      'Compatibilizar coeficientes CTE entre uniones para evitar grietas en ciclos día–noche.'
    ),
    buildPin(
      'carcasa_superior',
      'Cubierta Superior Expuesta',
      'Radiación ionizante, UV y choque térmico',
      [0.35, 1.15, 0.2],
      { abr: 0.6, ter: 1.3, rad: 1.38, pol: 1.2 },
      'Aplicar pintura térmica Z93 o lámina reflectiva MLI para controlar temperatura pico.'
    ),
    buildPin(
      'borde_expuesto',
      'Perímetro y Bordes de Arista',
      'Acumulación de polvo y erosión eólica',
      [-0.75, 0.55, 0.35],
      { abr: 1.15, ter: 1.1, rad: 1.1, pol: 1.35 },
      'Sellar aristas y juntas mecánicas mediante recubrimiento PTFE o cerámico hBN.'
    ),
  ];
}

export function compararMaterialesYRecubrimientos(
  sitio: SitioAmbiental,
  hardware: HardwareSpec,
  zona: ZonaDespliegue,
  dias: number,
  recubrimiento: RecubrimientoTipo = 'ninguno'
): AlloyComparisonRow[] {
  const matBase = MATERIALES_INGENIERIA[hardware.material];
  const ids: MaterialTipo[] = ['ti6al4v', 'basalto_cfrp', 'inox316l', 'vectran', 'al7075'];

  return ids
    .map((id) => {
      const m = MATERIALES_INGENIERIA[id];
      const hwTemp: HardwareSpec = { ...hardware, material: id };
      const snap = calcularDesgasteEnDia(sitio, hwTemp, zona, dias, recubrimiento);
      const masaEstimadaKg = Math.round(
        hardware.masaKg * (m.masaDensidadRel / Math.max(0.4, matBase.masaDensidadRel))
      );
      const estado: AlloyComparisonRow['estado'] =
        snap.integridadGlobal >= 72 ? 'Óptimo' : snap.integridadGlobal >= 48 ? 'Apto' : 'Riesgo';

      return {
        material: m,
        integridadPct: snap.integridadGlobal,
        abrasionPct: snap.abrasionMecanica,
        termicaPct: snap.fatigaTermica,
        radiacionPct: snap.degradacionRadiacion,
        vidaUtilDias: snap.vidaUtilEstimadaDias,
        masaEstimadaKg,
        estado,
      };
    })
    .sort((a, b) => b.integridadPct - a.integridadPct);
}

export function calcularBlindajeRadiacion(
  sitio: SitioAmbiental,
  materialId: BlindajeMaterialId,
  espesorCm: number,
  diasMision: number
): RadiationShieldResult {
  const spec = BLINDAJES_RADIACION[materialId];
  const cm = Math.max(0.2, Math.min(120, espesorCm));
  const dias = Math.max(1, diasMision);

  const arealDensityGcm2 = cm * spec.densidadGcm3;
  // Base mSv/day proporcional a sitio.radiacion (Marte ~0.64 mSv/día, Luna ~1.37 mSv/día, Tierra ~0.008)
  const dosisBaseMsvDia =
    sitio.id === 'tierra-atacama' || sitio.esTierra
      ? Math.max(0.005, sitio.radiacion * 0.012)
      : Math.max(0.25, sitio.radiacion * 0.022);

  // Atenuación exponencial primaria + término realista de secundarios por Bremsstrahlung/neutrones (NASA OLTARIS)
  const atenuacionPrimaria = Math.exp(-(arealDensityGcm2 / 36) * spec.factorAtenuacionGcr);
  const secundarios = spec.factorSecundario * (1 - Math.exp(-arealDensityGcm2 / 24));
  const factorTransmitido = clamp(atenuacionPrimaria + secundarios, 0.08, 1.0);

  const dosisAtenuadaMsvDia = dosisBaseMsvDia * factorTransmitido;
  const dosisTotalMisionMsv = dosisAtenuadaMsvDia * dias;
  const atenuacionPct = (1 - factorTransmitido) * 100;
  const fraccionLimiteNasa600MsvPct = (dosisTotalMisionMsv / 600) * 100;

  const nivelSeguridadTripulacion: RadiationShieldResult['nivelSeguridadTripulacion'] =
    dosisTotalMisionMsv > 600
      ? 'Excede Límite NASA'
      : dosisTotalMisionMsv > 250
        ? 'Controlado'
        : 'Seguro';

  const riesgoElectronica: RadiationShieldResult['riesgoElectronica'] =
    dosisAtenuadaMsvDia > 0.75 ? 'Alto' : dosisAtenuadaMsvDia > 0.25 ? 'Moderado' : 'Bajo';

  return {
    arealDensityGcm2,
    dosisSinBlindajeMsvDia: dosisBaseMsvDia,
    dosisAtenuadaMsvDia,
    dosisTotalMisionMsv,
    atenuacionPct,
    fraccionLimiteNasa600MsvPct,
    riesgoElectronica,
    nivelSeguridadTripulacion,
  };
}

export function simularFatigaCiclosDiaNoche(
  sitio: SitioAmbiental,
  hardware: HardwareSpec,
  zona: ZonaDespliegue,
  recubrimiento: RecubrimientoTipo = 'ninguno',
  maxCiclos = 1000
): {
  puntos: ThermalCyclePoint[];
  deltaTCicloK: number;
  ciclosHastaFalla50: number;
} {
  const mat = MATERIALES_INGENIERIA[hardware.material];
  const coat = RECUBRIMIENTOS_NASA[recubrimiento] ?? RECUBRIMIENTOS_NASA.ninguno;
  const tAmpLocal = sitio.T[1] * (zona.id === 'crater_sombra' ? 0.35 : 1.0);
  const deltaTCicloK = Math.max(4, 2 * tAmpLocal);

  // Modelo simplificado tipo Coffin-Manson para fatiga termomecánica cíclica
  const cteStress = Math.abs(mat.ctePpmK) / 14 + 0.55;
  const tasaPorCiclo =
    ((Math.pow(deltaTCicloK / 110, 1.65) * 0.0014 * cteStress) /
      (mat.resistenciaTermica * coat.multTermica)) *
    (hardware.tipo === 'traje' ? 1.3 : hardware.tipo === 'base' ? 0.78 : 1.0);

  const puntos: ThermalCyclePoint[] = [];
  const pasos = 50;
  for (let i = 0; i <= pasos; i++) {
    const ciclo = Math.round((i / pasos) * maxCiclos);
    const integridadEstructural = clamp(100 * Math.exp(-tasaPorCiclo * ciclo), 0, 100);
    const fatigaSellos = clamp(100 * (1 - Math.exp(-tasaPorCiclo * 1.45 * ciclo)), 0, 100);
    const polvoFactor = (sitio.viento[0] * 0.0015 + (sitio.P[0] < 10 ? 0.0012 : 0.0004)) / coat.multPolvo;
    const retencionPotencia = clamp(100 * Math.exp(-polvoFactor * ciclo * 0.65), 15, 100);

    puntos.push({
      ciclo,
      integridadEstructural,
      fatigaSellos,
      retencionPotencia,
    });
  }

  const ciclosHastaFalla50 = Math.round(clamp(0.693 / Math.max(1e-6, tasaPorCiclo), 15, 5000));

  return {
    puntos,
    deltaTCicloK,
    ciclosHastaFalla50,
  };
}

/**
 * Parser ligero de Wavefront .OBJ (vértices `v` y caras `f`) centrado y normalizado a [-1, 1].
 */
export function parseObjModel(text: string, fileName: string): CustomModelPayload {
  const rawVerts: Array<[number, number, number]> = [];
  const faces: Array<[number, number, number]> = [];

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('v ')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        const x = Number(parts[1]);
        const y = Number(parts[2]);
        const z = Number(parts[3]);
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
          rawVerts.push([x, y, z]);
        }
      }
    } else if (line.startsWith('f ')) {
      const parts = line.split(/\s+/).slice(1);
      const idxs: number[] = [];
      for (const tok of parts) {
        const vStr = tok.split('/')[0];
        let vIdx = parseInt(vStr, 10);
        if (!Number.isFinite(vIdx)) continue;
        if (vIdx < 0) vIdx = rawVerts.length + vIdx;
        else vIdx = vIdx - 1;
        if (vIdx >= 0 && vIdx < rawVerts.length) idxs.push(vIdx);
      }
      for (let i = 1; i + 1 < idxs.length; i++) {
        faces.push([idxs[0], idxs[i], idxs[i + 1]]);
      }
    }
  }

  if (rawVerts.length === 0) {
    throw new Error('El archivo .obj no contiene vértices válidos ("v x y z").');
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const [x, y, z] of rawVerts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(1e-5, maxX - minX, maxY - minY, maxZ - minZ);

  const vertices: Array<[number, number, number]> = rawVerts.map(([x, y, z]) => [
    ((x - cx) / span) * 2,
    ((y - cy) / span) * 2,
    ((z - cz) / span) * 2,
  ]);

  return {
    format: 'obj',
    fileName,
    vertices: vertices.slice(0, 6000),
    faces: faces.slice(0, 8000),
    rawText: text,
  };
}

export function parseCustomJsonSpec(
  text: string,
  fileName: string
): { specPatch: Partial<HardwareSpec>; payload: CustomModelPayload } {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const matRaw = String(parsed.material ?? 'ti6al4v');
  const material: MaterialTipo =
    matRaw in MATERIALES_INGENIERIA ? (matRaw as MaterialTipo) : 'ti6al4v';

  const poligonosRaw = Array.isArray(parsed.poligonos)
    ? (parsed.poligonos as Array<{ points: Array<[number, number]>; color?: string }>)
    : undefined;

  const vertsRaw = Array.isArray(parsed.vertices)
    ? (parsed.vertices as Array<[number, number, number]>)
    : undefined;
  const facesRaw = Array.isArray(parsed.faces)
    ? (parsed.faces as Array<[number, number, number]>)
    : undefined;

  const payload: CustomModelPayload = {
    format: vertsRaw?.length ? 'obj' : 'json',
    fileName,
    vertices: vertsRaw,
    faces: facesRaw,
    poligonos2d: poligonosRaw,
  };

  const specPatch: Partial<HardwareSpec> = {
    nombre: typeof parsed.nombre === 'string' ? parsed.nombre : fileName.replace(/\.json$/i, ''),
    descripcion:
      typeof parsed.descripcion === 'string'
        ? parsed.descripcion
        : `Modelo personalizado importado (${fileName})`,
    material,
    masaKg: Number(parsed.masaKg) > 0 ? Number(parsed.masaKg) : 450,
    selladoKpa: Number(parsed.selladoKpa) >= 0 ? Number(parsed.selladoKpa) : 30,
    tempMinK: Number.isFinite(Number(parsed.tempMinK)) ? Number(parsed.tempMinK) : 140,
    tempMaxK: Number.isFinite(Number(parsed.tempMaxK)) ? Number(parsed.tempMaxK) : 380,
    blindajeBase: Number(parsed.blindajeBase) > 0 ? Number(parsed.blindajeBase) : 1.2,
  };

  return { specPatch, payload };
}

export const SAMPLE_OBJ_ROVER = `# Modelo 3D simplificado Rover Prototipo (.OBJ)
v -0.9 -0.2 -0.6
v 0.9 -0.2 -0.6
v 0.9 -0.2 0.6
v -0.9 -0.2 0.6
v -0.7 0.35 -0.45
v 0.7 0.35 -0.45
v 0.7 0.35 0.45
v -0.7 0.35 0.45
v 0.4 0.35 0.0
v 0.45 1.05 0.0
v 0.68 1.05 -0.18
v 0.68 1.05 0.18
v -1.2 0.15 -0.9
v 1.2 0.15 -0.9
v 1.2 0.15 -0.45
v -1.2 0.15 -0.45
v -1.2 0.15 0.45
v 1.2 0.15 0.45
v 1.2 0.15 0.9
v -1.2 0.15 0.9
f 1 2 3 4
f 5 6 7 8
f 1 2 6 5
f 2 3 7 6
f 3 4 8 7
f 4 1 5 8
f 9 10 11
f 10 11 12
f 13 14 15 16
f 17 18 19 20
`;

export const SAMPLE_JSON_HABITAT = JSON.stringify(
  {
    nombre: 'Módulo Experimental Inflable V2',
    descripcion: 'Hábitat ligero multicapa Vectran + escudo térmico basal',
    material: 'vectran',
    masaKg: 4200,
    selladoKpa: 65,
    tempMinK: 120,
    tempMaxK: 390,
    blindajeBase: 1.4,
    poligonos: [
      { points: [[-0.9, 0], [-0.9, -0.55], [-0.45, -0.92], [0.45, -0.92], [0.9, -0.55], [0.9, 0]], color: '#06B6D4' },
      { points: [[-1.15, 0], [-0.9, 0], [-0.9, -0.42], [-1.15, -0.42]], color: '#F59E0B' },
      { points: [[-0.35, -0.58], [0.35, -0.58], [0.35, -0.32], [-0.35, -0.32]], color: '#38BDF8' },
    ],
  },
  null,
  2
);

interface DustGrain {
  x: number;
  y: number;
  vx: number;
  size: number;
}

interface RadBolt {
  x: number;
  y: number;
  len: number;
  life: number;
}

export interface WearRenderInput {
  sitioDestino: SitioAmbiental;
  sitioAnalogoTierra: SitioAmbiental | null;
  dualCompare: boolean;
  hardware: HardwareSpec;
  zona: ZonaDespliegue;
  customXNorm: number | null;
  diasSimulados: number;
  visualMode: WearVisualMode;
  playing: boolean;
}

/**
 * Motor Canvas dedicado a la simulación física de desgaste de hardware planetario.
 */
export class WearCanvasEngine {
  private timeSec = 0;
  private dust: DustGrain[] = [];
  private bolts: RadBolt[] = [];

  constructor() {
    this.dust = Array.from({ length: 75 }, (_, i) => ({
      x: ((i * 73) % 100) / 100,
      y: ((i * 41) % 90) / 100,
      vx: 0.4 + ((i * 19) % 10) * 0.1,
      size: 1.1 + (i % 3) * 0.65,
    }));
    this.bolts = Array.from({ length: 16 }, (_, i) => ({
      x: ((i * 59) % 100) / 100,
      y: ((i * 23) % 60) / 100,
      len: 12 + (i % 4) * 5,
      life: (i % 7) * 0.25,
    }));
  }

  public step(dtSec: number, input: WearRenderInput) {
    if (!input.playing) return;
    this.timeSec += dtSec;

    const vBase = clamp(input.sitioDestino.viento[0] * input.zona.multViento, 0, 28);
    for (const d of this.dust) {
      d.x += (0.04 + vBase * 0.018 * d.vx) * dtSec;
      d.y += Math.sin(this.timeSec * 2 + d.x * 12) * 0.015 * dtSec;
      if (d.x > 1.03) d.x = -0.03;
      if (d.y > 0.92) d.y = 0.08;
      if (d.y < 0.04) d.y = 0.85;
    }

    for (const b of this.bolts) {
      b.y += (0.35 + (input.sitioDestino.radiacion / 60) * 0.65) * dtSec;
      b.x += 0.1 * dtSec;
      b.life += dtSec;
      if (b.y > 0.82 || b.life > 1.4) {
        b.y = Math.random() * 0.15;
        b.x = Math.random();
        b.life = 0;
      }
    }
  }

  private sampleTerrainFrac(
    sitio: SitioAmbiental,
    zona: ZonaDespliegue,
    xNorm: number
  ): number {
    // Perfil topográfico con planicie, ladera, depresión de cráter y cresta solar
    const slopeTilt = clamp(sitio.pendiente * 0.0025, 0, 0.09);
    const roughAmp = 0.01 + clamp(sitio.rugosidad, 0.01, 0.2) * 0.18;
    const craterDip = -0.095 * Math.exp(-Math.pow((xNorm - 0.67) / 0.09, 2));
    const ridgeBump = 0.11 * Math.exp(-Math.pow((xNorm - 0.85) / 0.1, 2));
    const slopeBump = 0.04 * Math.exp(-Math.pow((xNorm - 0.45) / 0.12, 2));
    const ripple =
      Math.sin(xNorm * 18 + (sitio.lat ?? 1) * 0.2) * roughAmp +
      Math.cos(xNorm * 43) * roughAmp * 0.45;
    const extraLocal = zona.id === 'ladera' ? 0.01 : 0;
    return clamp(0.24 + (xNorm - 0.5) * slopeTilt + craterDip + ridgeBump + slopeBump + ripple + extraLocal, 0.1, 0.52);
  }

  public getTerrainSlopeAngle(
    sitio: SitioAmbiental,
    zona: ZonaDespliegue,
    xNorm: number,
    w: number,
    h: number
  ): number {
    const dx = 0.01;
    const y1 = h * (1 - this.sampleTerrainFrac(sitio, zona, clamp(xNorm - dx, 0, 1)));
    const y2 = h * (1 - this.sampleTerrainFrac(sitio, zona, clamp(xNorm + dx, 0, 1)));
    const px = 2 * dx * w;
    return Math.atan2(y2 - y1, px);
  }

  public render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number,
    input: WearRenderInput
  ) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, w, h);

    if (input.dualCompare && input.sitioAnalogoTierra && w >= 640) {
      const half = Math.floor(w / 2);
      this.renderSingleScene(ctx, 0, 0, half - 1, h, {
        ...input,
        sitio: input.sitioAnalogoTierra,
        etiquetaPane: 'ANÁLOGO EN TIERRA (CAMPO DE PRUEBAS)',
        accent: '#06B6D4',
      });
      this.renderSingleScene(ctx, half + 1, 0, w - half - 1, h, {
        ...input,
        sitio: input.sitioDestino,
        etiquetaPane: 'DESTINO PLANETARIO (OBJETIVO)',
        accent: '#F59E0B',
      });
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(half - 1, 0, 2, h);
    } else {
      this.renderSingleScene(ctx, 0, 0, w, h, {
        ...input,
        sitio: input.sitioDestino,
        etiquetaPane: `SIMULADOR DE DESGASTE · ${input.sitioDestino.nombre.toUpperCase()}`,
        accent: '#06B6D4',
      });
    }
  }

  private renderSingleScene(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    w: number,
    h: number,
    cfg: WearRenderInput & {
      sitio: SitioAmbiental;
      etiquetaPane: string;
      accent: string;
    }
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, w, h);
    ctx.clip();
    ctx.translate(ox, oy);

    const { sitio, hardware, zona, diasSimulados, visualMode } = cfg;
    const xActive = clamp(cfg.customXNorm ?? zona.xNorm, 0.08, 0.92);
    const metrics = calcularDesgasteEnDia(sitio, hardware, zona, diasSimulados);

    // 1. Cielo según presión y ciclo
    const p = sitio.P[0];
    const grad = ctx.createLinearGradient(0, 0, 0, h * 0.78);
    if (p < 50) {
      grad.addColorStop(0, '#04060D');
      grad.addColorStop(1, '#111827');
    } else if (p < 4000) {
      grad.addColorStop(0, '#2B1D1B');
      grad.addColorStop(0.65, '#6B3D29');
      grad.addColorStop(1, '#9A5A3A');
    } else {
      grad.addColorStop(0, '#0F2A4D');
      grad.addColorStop(0.7, '#255B8F');
      grad.addColorStop(1, '#5089B5');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Estrellas si atmósfera tenue o vacío
    if (p < 4000) {
      const starA = p < 50 ? 0.85 : 0.35;
      for (let i = 0; i < 65; i++) {
        const sx = (((i * 197 + 17) % 1000) / 1000) * w;
        const sy = (((i * 89 + 11) % 620) / 1000) * h;
        ctx.fillStyle = `rgba(226, 232, 240, ${starA * (0.4 + (i % 4) * 0.15)})`;
        ctx.fillRect(sx, sy, 1.4, 1.4);
      }
    }

    // Sol / Irradiancia
    const sunX = w * 0.8;
    const sunY = h * (zona.id === 'crater_sombra' ? 0.42 : 0.2);
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 70);
    const sunA = clamp((sitio.luz[0] * zona.multLuz) / 1361, 0.15, 1);
    sunGlow.addColorStop(0, `rgba(254, 240, 138, ${0.9 * sunA})`);
    sunGlow.addColorStop(0.35, `rgba(245, 158, 11, ${0.32 * sunA})`);
    sunGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
    ctx.fill();

    // 2. Relieve de fondo lejano
    ctx.fillStyle = p < 50 ? 'rgba(30, 41, 59, 0.55)' : 'rgba(15, 23, 42, 0.36)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 48; i++) {
      const f = i / 48;
      const ridgeY = h * (0.6 - 0.08 * Math.sin(f * 7.2 + (sitio.lat ?? 0)) - 0.04 * Math.cos(f * 15));
      ctx.lineTo(f * w, ridgeY);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // 3. Partículas de radiación si radiación alta o modo radiación activo
    if (sitio.radiacion > 2 || visualMode === 'radiacion') {
      const intensRad = visualMode === 'radiacion' ? 0.9 : clamp(sitio.radiacion / 60, 0.15, 0.7);
      ctx.lineWidth = visualMode === 'radiacion' ? 1.8 : 1.1;
      for (const b of this.bolts) {
        const bx = b.x * w;
        const by = b.y * h;
        ctx.strokeStyle = `rgba(244, 63, 94, ${intensRad * 0.75})`;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + 3, by + b.len);
        ctx.stroke();
      }
    }

    // 4. Suelo / Regolito con textura mineral
    const fe = sitio.suelo.Fe2O3 ?? 0.08;
    const isLunar = p < 50;
    const soilTop = isLunar
      ? '#64748B'
      : fe > 0.13
        ? '#B45334'
        : '#8B7355';
    const soilBot = isLunar ? '#1E293B' : fe > 0.13 ? '#3B1811' : '#261F18';

    const terrainGrad = ctx.createLinearGradient(0, h * 0.52, 0, h);
    terrainGrad.addColorStop(0, soilTop);
    terrainGrad.addColorStop(1, soilBot);

    ctx.fillStyle = terrainGrad;
    ctx.beginPath();
    ctx.moveTo(0, h);
    const steps = 90;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const ySurf = h * (1 - this.sampleTerrainFrac(sitio, zona, f));
      ctx.lineTo(f * w, ySurf);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Cresta superior del terreno + línea de abrasión si modo mecánico
    ctx.strokeStyle = visualMode === 'mecanico' ? '#F59E0B' : 'rgba(226, 232, 240, 0.45)';
    ctx.lineWidth = visualMode === 'mecanico' ? 2.2 : 1.3;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const ySurf = h * (1 - this.sampleTerrainFrac(sitio, zona, f));
      if (i === 0) ctx.moveTo(0, ySurf);
      else ctx.lineTo(f * w, ySurf);
    }
    ctx.stroke();

    // Zona en sombra para cráter en sombra
    const shadeX = 0.67 * w;
    const shadeGrad = ctx.createRadialGradient(shadeX, h * 0.78, 8, shadeX, h * 0.78, w * 0.11);
    shadeGrad.addColorStop(0, 'rgba(6, 182, 212, 0.16)');
    shadeGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = shadeGrad;
    ctx.fillRect(shadeX - w * 0.12, h * 0.55, w * 0.24, h * 0.4);

    // 5. Pines de zonas geológicas en el terreno
    for (const z of ZONAS_DESPLIEGUE) {
      const zx = z.xNorm * w;
      const zy = h * (1 - this.sampleTerrainFrac(sitio, zona, z.xNorm));
      const isSelected = z.id === zona.id;
      ctx.fillStyle = isSelected ? cfg.accent : 'rgba(148, 163, 184, 0.75)';
      ctx.beginPath();
      ctx.arc(zx, zy, isSelected ? 5.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isSelected ? '#F8FAFC' : 'rgba(15, 23, 42, 0.8)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      if (w >= 420) {
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = isSelected ? '#F8FAFC' : 'rgba(203, 213, 225, 0.75)';
        ctx.fillText(z.id === 'crater_sombra' ? 'SOMBRA' : z.id.toUpperCase(), zx, zy + 17);
      }
    }

    // 6. Viento y polvo abrasivo sobre la superficie
    if (sitio.viento[0] * zona.multViento > 0.2) {
      const dustAlpha = clamp((sitio.viento[0] * zona.multViento) / 14, 0.15, 0.7);
      ctx.fillStyle = fe > 0.13 ? `rgba(251, 146, 60, ${dustAlpha})` : `rgba(226, 232, 240, ${dustAlpha})`;
      for (const d of this.dust) {
        ctx.fillRect(d.x * w, d.y * h, d.size * 2.4, d.size * 0.9);
      }
    }

    // 7. Posición y ángulo del Hardware desplegado
    const anchorX = xActive * w;
    const anchorY = h * (1 - this.sampleTerrainFrac(sitio, zona, xActive));
    const slopeAngle = this.getTerrainSlopeAngle(sitio, zona, xActive, w, h);

    const scale = clamp(Math.min(w, h) / 420, 0.72, 1.35);

    ctx.save();
    ctx.translate(anchorX, anchorY);
    ctx.rotate(slopeAngle);
    ctx.scale(scale, scale);

    // Sombra de contacto
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 54 * hardware.anchoRel, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Renderizado específico del Hardware (pre-diseñado o subido por usuario)
    if (hardware.customModel) {
      this.drawCustomHardware(ctx, hardware, metrics, visualMode);
    } else if (hardware.tipo === 'rover') {
      this.drawRover(ctx, metrics, visualMode);
    } else if (hardware.tipo === 'traje') {
      this.drawSpacesuit(ctx, metrics, visualMode);
    } else {
      this.drawBase(ctx, metrics, visualMode);
    }

    // Líneas de micro-fractura / estrés si desgaste elevado
    if (metrics.integridadGlobal < 78) {
      const sev = clamp((80 - metrics.integridadGlobal) / 60, 0.15, 1);
      ctx.strokeStyle = `rgba(244, 63, 94, ${sev})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-22, -26);
      ctx.lineTo(-10, -18);
      ctx.lineTo(-14, -10);
      ctx.moveTo(14, -34);
      ctx.lineTo(24, -22);
      ctx.stroke();
    }

    // Overlay de estrés si está en modo termico / mecanico / radiacion
    if (visualMode !== 'fisico') {
      const auraColor =
        visualMode === 'termico'
          ? `rgba(249, 115, 22, ${0.15 + (metrics.fatigaTermica / 100) * 0.45})`
          : visualMode === 'mecanico'
            ? `rgba(245, 158, 11, ${0.15 + (metrics.abrasionMecanica / 100) * 0.45})`
            : `rgba(244, 63, 94, ${0.15 + (metrics.degradacionRadiacion / 100) * 0.45})`;
      const aura = ctx.createRadialGradient(0, -34, 8, 0, -34, 78);
      aura.addColorStop(0, auraColor);
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, -34, 78, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 8. HUD Canvas limpio superior
    ctx.fillStyle = 'rgba(7, 9, 14, 0.78)';
    ctx.fillRect(10, 10, Math.min(w - 20, 390), 50);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, Math.min(w - 20, 390), 50);

    ctx.fillStyle = cfg.accent;
    ctx.font = '600 10.5px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(cfg.etiquetaPane, 18, 26);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText(
      `INT ${metrics.integridadGlobal.toFixed(1)}% · T[${metrics.tMinLocalK.toFixed(0)}..${metrics.tMaxLocalK.toFixed(0)}K] · VIDA ~${metrics.vidaUtilEstimadaDias}d`,
      18,
      46
    );

    // Coordenadas / Hint abajo
    ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      `Clic en el terreno para reubicar · Modo: ${visualMode.toUpperCase()}`,
      w - 14,
      h - 12
    );

    ctx.restore();
  }

  private drawRover(
    ctx: CanvasRenderingContext2D,
    metrics: WearMetricsSnapshot,
    mode: WearVisualMode
  ) {
    const dustTint = clamp(metrics.obstruccionPolvo / 100, 0, 0.8);
    const bodyCol =
      mode === 'termico'
        ? '#EA580C'
        : mode === 'mecanico'
          ? '#D97706'
          : '#E2E8F0';

    // Suspensión rocker-bogie
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-42, -10);
    ctx.lineTo(-18, -32);
    ctx.lineTo(0, -10);
    ctx.moveTo(0, -10);
    ctx.lineTo(18, -32);
    ctx.lineTo(42, -10);
    ctx.stroke();

    // Cuerpo principal
    ctx.fillStyle = bodyCol;
    ctx.fillRect(-34, -46, 68, 20);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-34, -46, 68, 20);

    // Paneles / Cubierta dorada térmica + polvo acumulado
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(-26, -42, 42, 11);
    if (dustTint > 0.05) {
      ctx.fillStyle = `rgba(180, 83, 9, ${dustTint * 0.7})`;
      ctx.fillRect(-34, -46, 68, 7);
    }

    // Mástil y cabezal óptico
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, -46);
    ctx.lineTo(22, -74);
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(14, -84, 20, 12);
    ctx.fillStyle = '#06B6D4';
    ctx.fillRect(28, -81, 5, 6);

    // Brazo robótico delantero
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(34, -36);
    ctx.lineTo(50, -32);
    ctx.lineTo(56, -18);
    ctx.stroke();

    // 6 Ruedas metálicas (3 visibles de perfil con desgaste visible en tacos)
    const wheelXs = [-42, 0, 42];
    const rot = this.timeSec * 1.1;
    const wearColor =
      metrics.abrasionMecanica > 45 ? '#F43F5E' : '#06B6D4';

    for (const wx of wheelXs) {
      ctx.save();
      ctx.translate(wx, -10);
      ctx.rotate(rot);
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = mode === 'mecanico' ? wearColor : '#94A3B8';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Radios
      ctx.strokeStyle = wearColor;
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * -9, Math.sin(a) * -9);
        ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawSpacesuit(
    ctx: CanvasRenderingContext2D,
    metrics: WearMetricsSnapshot,
    mode: WearVisualMode
  ) {
    const suitBase =
      mode === 'termico'
        ? '#FB923C'
        : mode === 'radiacion'
          ? '#F43F5E'
          : '#F1F5F9';

    // Botas (sufren mayor abrasión)
    ctx.fillStyle = metrics.abrasionMecanica > 40 ? '#B45309' : '#334155';
    ctx.fillRect(-13, -10, 11, 10);
    ctx.fillRect(3, -10, 11, 10);

    // Piernas articuladas
    ctx.fillStyle = suitBase;
    ctx.fillRect(-11, -38, 9, 28);
    ctx.fillRect(3, -38, 9, 28);

    // Juntas de rodilla (estrés mecánico)
    ctx.fillStyle = mode === 'mecanico' ? '#F59E0B' : '#64748B';
    ctx.fillRect(-11, -26, 9, 4);
    ctx.fillRect(3, -26, 9, 4);

    // Mochila PLSS soporte vital
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(-20, -68, 12, 30);
    ctx.fillStyle = '#06B6D4';
    ctx.fillRect(-18, -64, 4, 8);

    // Torso presurizado
    ctx.fillStyle = suitBase;
    ctx.fillRect(-11, -68, 24, 31);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.3;
    ctx.strokeRect(-11, -68, 24, 31);

    // Módulo de control pecho
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-5, -60, 12, 10);
    ctx.fillStyle = '#06B6D4';
    ctx.fillRect(-2, -57, 6, 3);

    // Brazos
    ctx.fillStyle = suitBase;
    ctx.fillRect(13, -66, 7, 22);

    // Casco + visor áureo reflejante
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(1, -78, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.ellipse(4, -78, 8, 7, 0, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.fill();

    // Polvo acumulado en parte inferior
    if (metrics.obstruccionPolvo > 8) {
      const a = clamp(metrics.obstruccionPolvo / 110, 0.08, 0.65);
      ctx.fillStyle = `rgba(180, 83, 9, ${a})`;
      ctx.fillRect(-13, -28, 27, 28);
    }
  }

  private drawBase(
    ctx: CanvasRenderingContext2D,
    metrics: WearMetricsSnapshot,
    mode: WearVisualMode
  ) {
    const domeCol =
      mode === 'termico'
        ? '#C2410C'
        : mode === 'radiacion'
          ? '#9F1239'
          : '#CBD5E1';

    // Cimentación / zócalo
    ctx.fillStyle = '#334155';
    ctx.fillRect(-68, -8, 136, 8);

    // Domo geodésico presurizado
    ctx.fillStyle = domeCol;
    ctx.beginPath();
    ctx.arc(0, -8, 48, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Costillas estructurales del domo
    ctx.strokeStyle = mode === 'mecanico' ? '#F59E0B' : '#06B6D4';
    ctx.lineWidth = 1.2;
    for (const rx of [16, 32]) {
      ctx.beginPath();
      ctx.ellipse(0, -8, rx, 48, 0, Math.PI, 0);
      ctx.stroke();
    }

    // Esclusa presurizada derecha
    ctx.fillStyle = '#475569';
    ctx.fillRect(42, -32, 24, 24);
    ctx.fillStyle = '#06B6D4';
    ctx.fillRect(50, -26, 8, 10);

    // Arreglo solar / radiador izquierdo
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-58, -8);
    ctx.lineTo(-58, -50);
    ctx.stroke();

    ctx.fillStyle = '#0284C7';
    ctx.fillRect(-84, -56, 52, 12);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1;
    ctx.strokeRect(-84, -56, 52, 12);

    // Polvo sobre panel solar
    if (metrics.obstruccionPolvo > 5) {
      const a = clamp(metrics.obstruccionPolvo / 100, 0.05, 0.75);
      ctx.fillStyle = `rgba(180, 83, 9, ${a})`;
      ctx.fillRect(-84, -56, 52, 12);
    }

    // Antena de comunicaciones
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -56);
    ctx.lineTo(0, -78);
    ctx.stroke();
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(0, -80, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCustomHardware(
    ctx: CanvasRenderingContext2D,
    hardware: HardwareSpec,
    metrics: WearMetricsSnapshot,
    mode: WearVisualMode
  ) {
    const cm = hardware.customModel!;
    if (cm.format === 'image' && cm.imageEl && cm.imageEl.complete) {
      const maxDim = 92;
      const ratio = cm.imageEl.naturalWidth / Math.max(1, cm.imageEl.naturalHeight);
      const dw = ratio >= 1 ? maxDim : maxDim * ratio;
      const dh = ratio >= 1 ? maxDim / ratio : maxDim;

      // Marco técnico calibrado
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-dw / 2 - 4, -dh - 4, dw + 8, dh + 8);
      ctx.drawImage(cm.imageEl, -dw / 2, -dh, dw, dh);

      if (mode !== 'fisico') {
        ctx.fillStyle =
          mode === 'termico'
            ? 'rgba(249, 115, 22, 0.35)'
            : mode === 'mecanico'
              ? 'rgba(245, 158, 11, 0.35)'
              : 'rgba(244, 63, 94, 0.35)';
        ctx.fillRect(-dw / 2, -dh, dw, dh);
      }
      return;
    }

    if (cm.format === 'json' && cm.poligonos2d?.length) {
      const s = 48;
      for (const poly of cm.poligonos2d) {
        if (poly.points.length < 2) continue;
        ctx.beginPath();
        poly.points.forEach(([px, py], i) => {
          if (i === 0) ctx.moveTo(px * s, py * s);
          else ctx.lineTo(px * s, py * s);
        });
        ctx.closePath();
        ctx.fillStyle =
          mode === 'termico'
            ? 'rgba(234, 88, 12, 0.5)'
            : poly.color ?? 'rgba(6, 182, 212, 0.45)';
        ctx.fill();
        ctx.strokeStyle = '#F8FAFC';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      return;
    }

    // Malla 3D .OBJ proyectada en rotación lenta sobre el terreno
    if (cm.vertices?.length) {
      const yaw = this.timeSec * 0.55;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const scale3d = 42;

      const proj: Array<{ x: number; y: number; z: number }> = cm.vertices.map(([vx, vy, vz]) => {
        const rx = vx * cosY - vz * sinY;
        const rz = vx * sinY + vz * cosY;
        const px = rx * scale3d;
        const py = -vy * scale3d - 42 + rz * 6;
        return { x: px, y: py, z: rz };
      });

      const strokeCol =
        mode === 'termico'
          ? '#FB923C'
          : mode === 'mecanico'
            ? '#F59E0B'
            : mode === 'radiacion'
              ? '#F43F5E'
              : '#06B6D4';

      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 1.2;

      if (cm.faces?.length) {
        for (const [a, b, c] of cm.faces.slice(0, 1800)) {
          const pa = proj[a];
          const pb = proj[b];
          const pc = proj[c];
          if (!pa || !pb || !pc) continue;
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.lineTo(pc.x, pc.y);
          ctx.closePath();
          ctx.fillStyle =
            metrics.integridadGlobal < 50
              ? 'rgba(244, 63, 94, 0.14)'
              : 'rgba(6, 182, 212, 0.12)';
          ctx.fill();
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = strokeCol;
        for (const pt of proj) {
          ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
        }
      }
    }
  }
}
