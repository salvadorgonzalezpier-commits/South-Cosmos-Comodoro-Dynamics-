export type ModoComparacion = 'reloj' | 'ciclo';

export type VariableContinua =
  | 'temperatura'
  | 'presion'
  | 'viento'
  | 'luz'
  | 'gravedad'
  | 'radiacion';

export type VariableAnalogo =
  | VariableContinua
  | 'aire'
  | 'suelo'
  | 'terreno';

export interface SerieMedidaNASA {
  fuente: string;
  lat: number;
  lon: number;
  elevacionM: number | null;
  start: string;
  end: string;
  horas: number[];
  etiquetas: string[];
  temperaturaK: number[];
  presionPa: number[];
  vientoMs: number[];
  luzWm2: number[];
}

export type ModoProyeccionLatitud = 'lineal' | 'sinusoidal';

export interface ProyeccionLatitudConfig {
  activa: boolean;
  latDestino: number;
  modo: ModoProyeccionLatitud;
  gradienteLineal: number; // K / grado
  deltaEpSin: number; // K (contraste ecuador-polo)
  escalarAmplitud: boolean;
}

export interface SitioAmbiental {
  id: string;
  nombre: string;
  esTierra?: boolean;
  lat?: number;
  lon?: number;
  fuenteDatos?: string;
  serieMedida?: SerieMedidaNASA | null;
  usarSerieMedida?: boolean;
  desplazamientoTemp?: {
    deltaMedia: number;
    factorAmplitud: number;
    latOrigen: number;
    latDestino: number;
    modo: ModoProyeccionLatitud;
  };
  periodo: number; // duración del día local (horas)
  T: [number, number]; // media (K), amplitud diaria (K)
  P: [number, number]; // media (Pa), amplitud relativa
  viento: [number, number]; // media (m/s), amplitud relativa
  luz: [number, number | null]; // pico mediodía (W/m²)
  g: number; // m/s²
  radiacion: number; // µSv/h
  aire: Record<string, number>;
  suelo: Record<string, number>;
  pendiente: number; // grados
  rugosidad: number; // m
  esPersonalizado?: boolean;
}

export interface AnalogoTerrestrePreset {
  id: string;
  nombre: string;
  etiquetaSitio: string;
  lat: number;
  lon: number;
  periodo: number;
  T: [number, number];
  P: [number, number];
  viento: [number, number];
  luz: [number, number | null];
  suelo: Record<string, number>;
  pendiente: number;
  rugosidad: number;
  radiacion: number;
  queryCmr: string;
}

export const ANALOGOS_TERRESTRES_NASA: AnalogoTerrestrePreset[] = [
  {
    id: 'atacama-yungay',
    nombre: 'Atacama · Yungay (Chile)',
    etiquetaSitio: 'Tierra (Atacama · NASA Earthdata)',
    lat: -24.1,
    lon: -69.9,
    periodo: 24.0,
    T: [290, 12],
    P: [75000, 0.005],
    viento: [4.0, 0.5],
    luz: [1100, null],
    suelo: { SiO2: 0.6, Al2O3: 0.15, Fe2O3: 0.06, CaO: 0.05, MgO: 0.03, otros: 0.11 },
    pendiente: 5,
    rugosidad: 0.03,
    radiacion: 0.05,
    queryCmr: 'Atacama',
  },
  {
    id: 'antartida-mcmurdo',
    nombre: 'Antártida · Valles Secos McMurdo',
    etiquetaSitio: 'Tierra (Valles Secos · NASA Earthdata)',
    lat: -77.55,
    lon: 161.5,
    periodo: 24.0,
    T: [255, 6],
    P: [96000, 0.007],
    viento: [7.2, 0.6],
    luz: [450, null],
    suelo: { SiO2: 0.62, Al2O3: 0.14, Fe2O3: 0.07, CaO: 0.06, MgO: 0.04, otros: 0.07 },
    pendiente: 7,
    rugosidad: 0.04,
    radiacion: 0.08,
    queryCmr: 'McMurdo Dry Valleys',
  },
  {
    id: 'rio-tinto',
    nombre: 'Río Tinto · Huelva (España)',
    etiquetaSitio: 'Tierra (Río Tinto · NASA Earthdata)',
    lat: 37.7,
    lon: -6.55,
    periodo: 24.0,
    T: [291, 9],
    P: [98500, 0.004],
    viento: [3.6, 0.45],
    luz: [940, null],
    suelo: { SiO2: 0.49, Al2O3: 0.12, Fe2O3: 0.22, CaO: 0.03, MgO: 0.03, otros: 0.11 },
    pendiente: 8,
    rugosidad: 0.05,
    radiacion: 0.04,
    queryCmr: 'Spain mineral reflectance',
  },
  {
    id: 'mojave-barstow',
    nombre: 'Desierto de Mojave (EE. UU.)',
    etiquetaSitio: 'Tierra (Mojave · NASA Earthdata)',
    lat: 35.15,
    lon: -115.48,
    periodo: 24.0,
    T: [295, 11],
    P: [93500, 0.005],
    viento: [4.4, 0.5],
    luz: [980, null],
    suelo: { SiO2: 0.64, Al2O3: 0.14, Fe2O3: 0.05, CaO: 0.05, MgO: 0.03, otros: 0.09 },
    pendiente: 4,
    rugosidad: 0.03,
    radiacion: 0.04,
    queryCmr: 'Mojave',
  },
  {
    id: 'askja-islandia',
    nombre: 'Caldera Askja (Islandia)',
    etiquetaSitio: 'Tierra (Askja · NASA Earthdata)',
    lat: 65.03,
    lon: -16.75,
    periodo: 24.0,
    T: [274, 5],
    P: [88500, 0.008],
    viento: [7.8, 0.55],
    luz: [560, null],
    suelo: { SiO2: 0.50, Al2O3: 0.14, Fe2O3: 0.14, CaO: 0.10, MgO: 0.07, otros: 0.05 },
    pendiente: 9,
    rugosidad: 0.07,
    radiacion: 0.04,
    queryCmr: 'Iceland volcanic',
  },
  {
    id: 'devon-haughton',
    nombre: 'Isla Devon · Cráter Haughton (Canadá)',
    etiquetaSitio: 'Tierra (Isla Devon Haughton · NASA Earthdata)',
    lat: 75.37,
    lon: -89.68,
    periodo: 24.0,
    T: [257, 6],
    P: [100800, 0.008],
    viento: [6.2, 0.6],
    luz: [420, null],
    suelo: { SiO2: 0.44, Al2O3: 0.09, Fe2O3: 0.05, CaO: 0.22, MgO: 0.10, otros: 0.10 },
    pendiente: 8,
    rugosidad: 0.06,
    radiacion: 0.07,
    queryCmr: 'Devon Island Haughton',
  },
  {
    id: 'mauna-kea',
    nombre: 'Mauna Kea · HI-SEAS (Hawái)',
    etiquetaSitio: 'Tierra (Mauna Kea HI-SEAS · NASA Earthdata)',
    lat: 19.76,
    lon: -155.46,
    periodo: 24.0,
    T: [281, 7],
    P: [74500, 0.004],
    viento: [5.5, 0.5],
    luz: [1150, null],
    suelo: { SiO2: 0.48, Al2O3: 0.15, Fe2O3: 0.13, CaO: 0.10, MgO: 0.08, otros: 0.06 },
    pendiente: 11,
    rugosidad: 0.08,
    radiacion: 0.06,
    queryCmr: 'Mauna Kea basalt',
  },
  {
    id: 'uyuni-salar',
    nombre: 'Salar de Uyuni (Bolivia)',
    etiquetaSitio: 'Tierra (Salar de Uyuni · NASA Earthdata)',
    lat: -20.13,
    lon: -67.49,
    periodo: 24.0,
    T: [282, 13],
    P: [64800, 0.005],
    viento: [4.6, 0.55],
    luz: [1220, null],
    suelo: { SiO2: 0.36, Al2O3: 0.07, Fe2O3: 0.04, CaO: 0.14, MgO: 0.08, otros: 0.31 },
    pendiente: 1,
    rugosidad: 0.02,
    radiacion: 0.07,
    queryCmr: 'Uyuni salt flat',
  },
  {
    id: 'svalbard-arctic',
    nombre: 'Svalbard · Spitsbergen (Noruega)',
    etiquetaSitio: 'Tierra (Svalbard · NASA Earthdata)',
    lat: 78.22,
    lon: 15.63,
    periodo: 24.0,
    T: [267, 5],
    P: [101100, 0.009],
    viento: [6.8, 0.55],
    luz: [380, null],
    suelo: { SiO2: 0.52, Al2O3: 0.12, Fe2O3: 0.08, CaO: 0.11, MgO: 0.07, otros: 0.10 },
    pendiente: 10,
    rugosidad: 0.06,
    radiacion: 0.07,
    queryCmr: 'Svalbard permafrost',
  },
  {
    id: 'wadi-rum',
    nombre: 'Wadi Rum (Jordania)',
    etiquetaSitio: 'Tierra (Wadi Rum · NASA Earthdata)',
    lat: 29.57,
    lon: 35.42,
    periodo: 24.0,
    T: [294, 11],
    P: [91200, 0.004],
    viento: [3.9, 0.5],
    luz: [1040, null],
    suelo: { SiO2: 0.68, Al2O3: 0.11, Fe2O3: 0.10, CaO: 0.04, MgO: 0.02, otros: 0.05 },
    pendiente: 6,
    rugosidad: 0.04,
    radiacion: 0.04,
    queryCmr: 'Jordan desert sandstone',
  },
  {
    id: 'namib-dunes',
    nombre: 'Desierto del Namib · Gobabeb (Namibia)',
    etiquetaSitio: 'Tierra (Desierto del Namib · NASA Earthdata)',
    lat: -23.56,
    lon: 15.04,
    periodo: 24.0,
    T: [292, 10],
    P: [96500, 0.004],
    viento: [5.0, 0.55],
    luz: [1060, null],
    suelo: { SiO2: 0.72, Al2O3: 0.09, Fe2O3: 0.08, CaO: 0.04, MgO: 0.02, otros: 0.05 },
    pendiente: 6,
    rugosidad: 0.03,
    radiacion: 0.04,
    queryCmr: 'Namib desert dunes',
  },
  {
    id: 'dallol-danakil',
    nombre: 'Depresión de Danakil · Dallol (Etiopía)',
    etiquetaSitio: 'Tierra (Dallol Danakil · NASA Earthdata)',
    lat: 14.24,
    lon: 40.30,
    periodo: 24.0,
    T: [308, 9],
    P: [102500, 0.003],
    viento: [4.2, 0.45],
    luz: [1090, null],
    suelo: { SiO2: 0.38, Al2O3: 0.08, Fe2O3: 0.16, CaO: 0.10, MgO: 0.07, otros: 0.21 },
    pendiente: 3,
    rugosidad: 0.04,
    radiacion: 0.04,
    queryCmr: 'Afar Danakil hydrothermal',
  },
  {
    id: 'qaidam-basin',
    nombre: 'Cuenca de Qaidam · Mangnai (China)',
    etiquetaSitio: 'Tierra (Cuenca Qaidam · NASA Earthdata)',
    lat: 38.25,
    lon: 90.85,
    periodo: 24.0,
    T: [277, 13],
    P: [71200, 0.006],
    viento: [5.4, 0.6],
    luz: [980, null],
    suelo: { SiO2: 0.54, Al2O3: 0.12, Fe2O3: 0.07, CaO: 0.09, MgO: 0.06, otros: 0.12 },
    pendiente: 4,
    rugosidad: 0.04,
    radiacion: 0.06,
    queryCmr: 'Qaidam basin playa',
  },
  {
    id: 'lanzarote-timanfaya',
    nombre: 'Lanzarote · Timanfaya (España)',
    etiquetaSitio: 'Tierra (Lanzarote Timanfaya · NASA Earthdata)',
    lat: 29.0,
    lon: -13.75,
    periodo: 24.0,
    T: [293, 6],
    P: [99200, 0.004],
    viento: [6.5, 0.45],
    luz: [990, null],
    suelo: { SiO2: 0.47, Al2O3: 0.14, Fe2O3: 0.14, CaO: 0.11, MgO: 0.09, otros: 0.05 },
    pendiente: 9,
    rugosidad: 0.08,
    radiacion: 0.04,
    queryCmr: 'Canary Islands basaltic',
  },
  {
    id: 'craters-of-the-moon',
    nombre: 'Craters of the Moon · Idaho (EE. UU.)',
    etiquetaSitio: 'Tierra (Craters of the Moon · NASA Earthdata)',
    lat: 43.46,
    lon: -113.56,
    periodo: 24.0,
    T: [280, 12],
    P: [81800, 0.006],
    viento: [4.8, 0.5],
    luz: [920, null],
    suelo: { SiO2: 0.49, Al2O3: 0.14, Fe2O3: 0.14, CaO: 0.09, MgO: 0.07, otros: 0.07 },
    pendiente: 7,
    rugosidad: 0.07,
    radiacion: 0.05,
    queryCmr: 'Snake River Plain basalt',
  },
];

export interface AnalogoPlanetarioPds {
  id: string;
  cuerpo: 'luna' | 'marte';
  nombre: string;
  etiquetaSitio: string;
  misionFuente: string;
  lat: number;
  lon: number;
  periodo: number;
  T: [number, number];
  P: [number, number];
  viento: [number, number];
  luz: [number, number | null];
  g: number;
  radiacion: number;
  suelo: Record<string, number>;
  pendiente: number;
  rugosidad: number;
  queryPds: string;
}

export const ANALOGOS_LUNA_MARTE_PDS: AnalogoPlanetarioPds[] = [
  {
    id: 'luna-mare-ecuador',
    cuerpo: 'luna',
    nombre: 'Mare Tranquillitatis (ecuador)',
    etiquetaSitio: 'Luna (Mare Tranquillitatis · LRO PDS)',
    misionFuente: 'LRO Diviner (DLRE) + LOLA + Apollo 11',
    lat: 0.67,
    lon: 23.47,
    periodo: 708.7,
    T: [245, 145],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [1361, null],
    g: 1.62,
    radiacion: 60,
    suelo: { SiO2: 0.45, Al2O3: 0.14, Fe2O3: 0.17, CaO: 0.12, MgO: 0.08, otros: 0.04 },
    pendiente: 5,
    rugosidad: 0.04,
    queryPds: 'LRO',
  },
  {
    id: 'luna-shackleton-sur',
    cuerpo: 'luna',
    nombre: 'Polo Sur · Borde Shackleton',
    etiquetaSitio: 'Luna (Polo Sur Shackleton · LRO PDS)',
    misionFuente: 'LRO Diviner GDR_L3 + LOLA Polar DEM',
    lat: -89.5,
    lon: 129.8,
    periodo: 708.7,
    T: [95, 35],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [180, null],
    g: 1.62,
    radiacion: 62,
    suelo: { SiO2: 0.45, Al2O3: 0.25, Fe2O3: 0.06, CaO: 0.15, MgO: 0.06, otros: 0.03 },
    pendiente: 14,
    rugosidad: 0.09,
    queryPds: 'Diviner',
  },
  {
    id: 'luna-descartes-altas',
    cuerpo: 'luna',
    nombre: 'Tierras Altas (Descartes / Apollo 16)',
    etiquetaSitio: 'Luna (Tierras Altas · LRO PDS)',
    misionFuente: 'LRO LROC + LOLA + Apollo 16 Regolith',
    lat: -8.97,
    lon: 15.5,
    periodo: 708.7,
    T: [240, 140],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [1350, null],
    g: 1.62,
    radiacion: 58,
    suelo: { SiO2: 0.45, Al2O3: 0.27, Fe2O3: 0.05, CaO: 0.16, MgO: 0.05, otros: 0.02 },
    pendiente: 9,
    rugosidad: 0.06,
    queryPds: 'LOLA',
  },
  {
    id: 'luna-oceanus-procellarum',
    cuerpo: 'luna',
    nombre: 'Oceanus Procellarum · Reiner Gamma',
    etiquetaSitio: 'Luna (Oceanus Procellarum · LRO PDS)',
    misionFuente: 'LRO Diviner + M3 Moon Mineralogy Mapper (PDS)',
    lat: 7.4,
    lon: -59.0,
    periodo: 708.7,
    T: [246, 143],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [1355, null],
    g: 1.62,
    radiacion: 59,
    suelo: { SiO2: 0.43, Al2O3: 0.13, Fe2O3: 0.19, CaO: 0.11, MgO: 0.09, otros: 0.05 },
    pendiente: 3,
    rugosidad: 0.03,
    queryPds: 'Diviner',
  },
  {
    id: 'luna-tycho-crater',
    cuerpo: 'luna',
    nombre: 'Cráter Tycho · Pico Central',
    etiquetaSitio: 'Luna (Cráter Tycho · LRO PDS)',
    misionFuente: 'LRO LROC NAC + Diviner Rock Abundance (PDS)',
    lat: -43.31,
    lon: -11.36,
    periodo: 708.7,
    T: [215, 118],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [990, null],
    g: 1.62,
    radiacion: 61,
    suelo: { SiO2: 0.45, Al2O3: 0.26, Fe2O3: 0.06, CaO: 0.15, MgO: 0.06, otros: 0.02 },
    pendiente: 16,
    rugosidad: 0.12,
    queryPds: 'LROC',
  },
  {
    id: 'luna-copernicus-crater',
    cuerpo: 'luna',
    nombre: 'Cráter Copernicus (eyecta KREEP)',
    etiquetaSitio: 'Luna (Cráter Copernicus · LRO PDS)',
    misionFuente: 'LRO LOLA + Diviner + Kaguya Spectral (PDS)',
    lat: 9.62,
    lon: -20.08,
    periodo: 708.7,
    T: [242, 139],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [1340, null],
    g: 1.62,
    radiacion: 60,
    suelo: { SiO2: 0.46, Al2O3: 0.21, Fe2O3: 0.10, CaO: 0.13, MgO: 0.07, otros: 0.03 },
    pendiente: 11,
    rugosidad: 0.08,
    queryPds: 'LRO',
  },
  {
    id: 'luna-aristarchus-plateau',
    cuerpo: 'luna',
    nombre: 'Meseta de Aristarchus (piroclastos)',
    etiquetaSitio: 'Luna (Aristarchus · LRO PDS)',
    misionFuente: 'LRO Diviner + LROC + Lunar Prospector (PDS)',
    lat: 23.73,
    lon: -47.49,
    periodo: 708.7,
    T: [236, 134],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [1245, null],
    g: 1.62,
    radiacion: 60,
    suelo: { SiO2: 0.44, Al2O3: 0.15, Fe2O3: 0.16, CaO: 0.11, MgO: 0.09, otros: 0.05 },
    pendiente: 7,
    rugosidad: 0.05,
    queryPds: 'Lunar Prospector',
  },
  {
    id: 'luna-taurus-littrow',
    cuerpo: 'luna',
    nombre: 'Taurus-Littrow (Apollo 17)',
    etiquetaSitio: 'Luna (Taurus-Littrow · LRO PDS)',
    misionFuente: 'LRO LROC + Apollo 17 Heat Flow & Soil (PDS)',
    lat: 20.19,
    lon: 30.77,
    periodo: 708.7,
    T: [239, 136],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [1275, null],
    g: 1.62,
    radiacion: 59,
    suelo: { SiO2: 0.41, Al2O3: 0.13, Fe2O3: 0.18, CaO: 0.11, MgO: 0.09, otros: 0.08 },
    pendiente: 8,
    rugosidad: 0.05,
    queryPds: 'Apollo 17',
  },
  {
    id: 'luna-hadley-rille',
    cuerpo: 'luna',
    nombre: 'Hadley Rille · Montes Apenninus (Apollo 15)',
    etiquetaSitio: 'Luna (Hadley Rille · LRO PDS)',
    misionFuente: 'LRO LOLA DEM + Apollo 15 Orbital Geochem (PDS)',
    lat: 26.13,
    lon: 3.63,
    periodo: 708.7,
    T: [234, 132],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [1220, null],
    g: 1.62,
    radiacion: 60,
    suelo: { SiO2: 0.46, Al2O3: 0.16, Fe2O3: 0.14, CaO: 0.11, MgO: 0.09, otros: 0.04 },
    pendiente: 12,
    rugosidad: 0.07,
    queryPds: 'Apollo 15',
  },
  {
    id: 'luna-fra-mauro',
    cuerpo: 'luna',
    nombre: 'Fra Mauro · Formación Imbrium (Apollo 14)',
    etiquetaSitio: 'Luna (Fra Mauro · LRO PDS)',
    misionFuente: 'LRO LROC + Apollo 14 Regolith Samples (PDS)',
    lat: -3.65,
    lon: -17.47,
    periodo: 708.7,
    T: [244, 142],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [1358, null],
    g: 1.62,
    radiacion: 59,
    suelo: { SiO2: 0.47, Al2O3: 0.19, Fe2O3: 0.11, CaO: 0.12, MgO: 0.08, otros: 0.03 },
    pendiente: 6,
    rugosidad: 0.05,
    queryPds: 'Apollo 14',
  },
  {
    id: 'luna-mare-imbrium',
    cuerpo: 'luna',
    nombre: 'Mare Imbrium · Sinus Iridum',
    etiquetaSitio: 'Luna (Mare Imbrium · LRO PDS)',
    misionFuente: 'LRO Diviner + LOLA + Chang-e / Clementine (PDS)',
    lat: 44.1,
    lon: -31.5,
    periodo: 708.7,
    T: [212, 115],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [975, null],
    g: 1.62,
    radiacion: 61,
    suelo: { SiO2: 0.44, Al2O3: 0.14, Fe2O3: 0.18, CaO: 0.11, MgO: 0.09, otros: 0.04 },
    pendiente: 4,
    rugosidad: 0.03,
    queryPds: 'Clementine',
  },
  {
    id: 'luna-von-karman-farside',
    cuerpo: 'luna',
    nombre: 'Cráter Von Kármán (Cara Oculta · SPA)',
    etiquetaSitio: 'Luna (Von Kármán · LRO PDS)',
    misionFuente: 'LRO LOLA + Diviner South Pole-Aitken Basin (PDS)',
    lat: -44.8,
    lon: 175.9,
    periodo: 708.7,
    T: [210, 114],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [965, null],
    g: 1.62,
    radiacion: 61,
    suelo: { SiO2: 0.45, Al2O3: 0.18, Fe2O3: 0.14, CaO: 0.12, MgO: 0.08, otros: 0.03 },
    pendiente: 5,
    rugosidad: 0.04,
    queryPds: 'Diviner',
  },
  {
    id: 'luna-cabeus-polar',
    cuerpo: 'luna',
    nombre: 'Cráter Cabeus · Polo Sur (LCROSS)',
    etiquetaSitio: 'Luna (Cráter Cabeus · LRO/LCROSS PDS)',
    misionFuente: 'LCROSS + LRO LAMP + Diviner Polar Volatiles (PDS)',
    lat: -84.9,
    lon: -35.5,
    periodo: 708.7,
    T: [108, 45],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [220, null],
    g: 1.62,
    radiacion: 62,
    suelo: { SiO2: 0.44, Al2O3: 0.25, Fe2O3: 0.06, CaO: 0.15, MgO: 0.06, otros: 0.04 },
    pendiente: 15,
    rugosidad: 0.10,
    queryPds: 'LCROSS',
  },
  {
    id: 'marte-gale-msl',
    cuerpo: 'marte',
    nombre: 'Cráter Gale (MSL Curiosity)',
    etiquetaSitio: 'Marte (Cráter Gale · PDS MSL/REMS)',
    misionFuente: 'MSL REMS + RAD + APXS (PDS)',
    lat: -4.59,
    lon: 137.44,
    periodo: 24.66,
    T: [218, 45],
    P: [750, 0.05],
    viento: [4, 0.6],
    luz: [500, null],
    g: 3.71,
    radiacion: 28,
    suelo: { SiO2: 0.43, Al2O3: 0.09, Fe2O3: 0.19, CaO: 0.07, MgO: 0.09, otros: 0.13 },
    pendiente: 5,
    rugosidad: 0.05,
    queryPds: 'MSL',
  },
  {
    id: 'marte-jezero-2020',
    cuerpo: 'marte',
    nombre: 'Cráter Jezero (Mars 2020 Perseverance)',
    etiquetaSitio: 'Marte (Cráter Jezero · PDS MEDA)',
    misionFuente: 'Mars 2020 MEDA + MRO CRISM/HiRISE (PDS)',
    lat: 18.38,
    lon: 77.58,
    periodo: 24.66,
    T: [215, 42],
    P: [730, 0.04],
    viento: [5.2, 0.65],
    luz: [520, null],
    g: 3.71,
    radiacion: 29,
    suelo: { SiO2: 0.44, Al2O3: 0.08, Fe2O3: 0.18, CaO: 0.06, MgO: 0.11, otros: 0.13 },
    pendiente: 6,
    rugosidad: 0.06,
    queryPds: 'Mars 2020',
  },
  {
    id: 'marte-elysium-insight',
    cuerpo: 'marte',
    nombre: 'Elysium Planitia (InSight TWINS)',
    etiquetaSitio: 'Marte (Elysium Planitia · PDS InSight)',
    misionFuente: 'InSight APSS/TWINS + MGS MOLA (PDS)',
    lat: 4.5,
    lon: 135.62,
    periodo: 24.66,
    T: [212, 46],
    P: [715, 0.045],
    viento: [4.8, 0.55],
    luz: [510, null],
    g: 3.71,
    radiacion: 28,
    suelo: { SiO2: 0.45, Al2O3: 0.09, Fe2O3: 0.18, CaO: 0.07, MgO: 0.09, otros: 0.12 },
    pendiente: 3,
    rugosidad: 0.03,
    queryPds: 'InSight',
  },
  {
    id: 'marte-chryse-viking1',
    cuerpo: 'marte',
    nombre: 'Chryse Planitia (Viking Lander 1)',
    etiquetaSitio: 'Marte (Chryse Planitia · PDS Viking 1)',
    misionFuente: 'Viking 1 Meteorology + XRFS + MOLA (PDS)',
    lat: 22.27,
    lon: -47.95,
    periodo: 24.66,
    T: [214, 41],
    P: [760, 0.045],
    viento: [4.5, 0.55],
    luz: [505, null],
    g: 3.71,
    radiacion: 28,
    suelo: { SiO2: 0.44, Al2O3: 0.07, Fe2O3: 0.18, CaO: 0.06, MgO: 0.08, otros: 0.17 },
    pendiente: 3,
    rugosidad: 0.05,
    queryPds: 'Viking',
  },
  {
    id: 'marte-utopia-viking2',
    cuerpo: 'marte',
    nombre: 'Utopia Planitia (Viking Lander 2)',
    etiquetaSitio: 'Marte (Utopia Planitia · PDS Viking 2)',
    misionFuente: 'Viking 2 Meteorology + MRO SHARAD/HiRISE (PDS)',
    lat: 47.64,
    lon: 134.29,
    periodo: 24.66,
    T: [201, 37],
    P: [810, 0.05],
    viento: [5.4, 0.6],
    luz: [385, null],
    g: 3.71,
    radiacion: 29,
    suelo: { SiO2: 0.43, Al2O3: 0.08, Fe2O3: 0.18, CaO: 0.06, MgO: 0.07, otros: 0.18 },
    pendiente: 2,
    rugosidad: 0.04,
    queryPds: 'Viking',
  },
  {
    id: 'marte-ares-pathfinder',
    cuerpo: 'marte',
    nombre: 'Ares Vallis (Mars Pathfinder)',
    etiquetaSitio: 'Marte (Ares Vallis · PDS Pathfinder)',
    misionFuente: 'MPF ASI/MET + APXS + IMP (PDS)',
    lat: 19.13,
    lon: -33.22,
    periodo: 24.66,
    T: [216, 43],
    P: [680, 0.045],
    viento: [5.0, 0.6],
    luz: [515, null],
    g: 3.71,
    radiacion: 28,
    suelo: { SiO2: 0.47, Al2O3: 0.09, Fe2O3: 0.17, CaO: 0.06, MgO: 0.08, otros: 0.13 },
    pendiente: 4,
    rugosidad: 0.07,
    queryPds: 'Pathfinder',
  },
  {
    id: 'marte-gusev-spirit',
    cuerpo: 'marte',
    nombre: 'Cráter Gusev · Columbia Hills (MER Spirit)',
    etiquetaSitio: 'Marte (Cráter Gusev · PDS MER Spirit)',
    misionFuente: 'MER-A Mini-TES + APXS + Mössbauer (PDS)',
    lat: -14.57,
    lon: 175.47,
    periodo: 24.66,
    T: [220, 46],
    P: [740, 0.045],
    viento: [5.8, 0.65],
    luz: [525, null],
    g: 3.71,
    radiacion: 28,
    suelo: { SiO2: 0.45, Al2O3: 0.10, Fe2O3: 0.17, CaO: 0.06, MgO: 0.09, otros: 0.13 },
    pendiente: 8,
    rugosidad: 0.06,
    queryPds: 'MER',
  },
  {
    id: 'marte-meridiani-opportunity',
    cuerpo: 'marte',
    nombre: 'Meridiani Planum (MER Opportunity)',
    etiquetaSitio: 'Marte (Meridiani Planum · PDS MER Oppy)',
    misionFuente: 'MER-B Mini-TES + APXS Hematite/Sulfates (PDS)',
    lat: -1.95,
    lon: -5.53,
    periodo: 24.66,
    T: [221, 44],
    P: [690, 0.04],
    viento: [4.3, 0.5],
    luz: [540, null],
    g: 3.71,
    radiacion: 28,
    suelo: { SiO2: 0.42, Al2O3: 0.08, Fe2O3: 0.22, CaO: 0.05, MgO: 0.08, otros: 0.15 },
    pendiente: 2,
    rugosidad: 0.02,
    queryPds: 'Opportunity',
  },
  {
    id: 'marte-vastitas-phoenix',
    cuerpo: 'marte',
    nombre: 'Vastitas Borealis · Polar Norte (Phoenix)',
    etiquetaSitio: 'Marte (Vastitas Borealis · PDS Phoenix)',
    misionFuente: 'Phoenix MET + TECP + MECA (PDS)',
    lat: 68.22,
    lon: -125.7,
    periodo: 24.66,
    T: [188, 28],
    P: [840, 0.05],
    viento: [4.9, 0.55],
    luz: [250, null],
    g: 3.71,
    radiacion: 30,
    suelo: { SiO2: 0.41, Al2O3: 0.08, Fe2O3: 0.17, CaO: 0.07, MgO: 0.09, otros: 0.18 },
    pendiente: 2,
    rugosidad: 0.03,
    queryPds: 'Phoenix',
  },
  {
    id: 'marte-olympus-mons',
    cuerpo: 'marte',
    nombre: 'Olympus Mons · Flanco Caldera (+21 km)',
    etiquetaSitio: 'Marte (Olympus Mons · PDS MOLA/THEMIS)',
    misionFuente: 'MGS MOLA + Odyssey THEMIS + MRO CRISM (PDS)',
    lat: 18.65,
    lon: -133.8,
    periodo: 24.66,
    T: [195, 52],
    P: [72, 0.06],
    viento: [8.5, 0.7],
    luz: [560, null],
    g: 3.71,
    radiacion: 34,
    suelo: { SiO2: 0.46, Al2O3: 0.10, Fe2O3: 0.17, CaO: 0.08, MgO: 0.09, otros: 0.10 },
    pendiente: 14,
    rugosidad: 0.09,
    queryPds: 'THEMIS',
  },
  {
    id: 'marte-valles-marineris',
    cuerpo: 'marte',
    nombre: 'Valles Marineris · Melas Chasma (-4 km)',
    etiquetaSitio: 'Marte (Melas Chasma · PDS MOLA/HiRISE)',
    misionFuente: 'MGS MOLA + MRO HiRISE + CRISM Sulfates (PDS)',
    lat: -10.3,
    lon: -73.6,
    periodo: 24.66,
    T: [226, 47],
    P: [1050, 0.04],
    viento: [6.4, 0.6],
    luz: [490, null],
    g: 3.71,
    radiacion: 25,
    suelo: { SiO2: 0.42, Al2O3: 0.08, Fe2O3: 0.20, CaO: 0.06, MgO: 0.09, otros: 0.15 },
    pendiente: 17,
    rugosidad: 0.10,
    queryPds: 'HiRISE',
  },
  {
    id: 'marte-hellas-planitia',
    cuerpo: 'marte',
    nombre: 'Hellas Planitia · Cuenca Sur (-7 km)',
    etiquetaSitio: 'Marte (Hellas Planitia · PDS MOLA/TES)',
    misionFuente: 'MGS MOLA + TES + Mars Express OMEGA (PDS/PSA)',
    lat: -42.4,
    lon: 70.5,
    periodo: 24.66,
    T: [208, 40],
    P: [1155, 0.04],
    viento: [6.1, 0.6],
    luz: [410, null],
    g: 3.71,
    radiacion: 24,
    suelo: { SiO2: 0.44, Al2O3: 0.09, Fe2O3: 0.18, CaO: 0.07, MgO: 0.09, otros: 0.13 },
    pendiente: 3,
    rugosidad: 0.04,
    queryPds: 'MOLA',
  },
  {
    id: 'marte-oxya-planum',
    cuerpo: 'marte',
    nombre: 'Oxia Planum (Zona ExoMars)',
    etiquetaSitio: 'Marte (Oxia Planum · PDS CRISM/HiRISE)',
    misionFuente: 'MRO CRISM Clay Phyllosilicates + HiRISE (PDS)',
    lat: 18.28,
    lon: -24.37,
    periodo: 24.66,
    T: [216, 42],
    P: [765, 0.045],
    viento: [4.6, 0.55],
    luz: [515, null],
    g: 3.71,
    radiacion: 28,
    suelo: { SiO2: 0.45, Al2O3: 0.10, Fe2O3: 0.17, CaO: 0.06, MgO: 0.10, otros: 0.12 },
    pendiente: 4,
    rugosidad: 0.04,
    queryPds: 'CRISM',
  },
];

export interface SerieTemporal {
  t: number[];
  temperatura: number[];
  presion: number[];
  viento: number[];
  luz: number[];
  gravedad: number[];
  radiacion: number[];
}

export interface ResultadoComparacion {
  sitioA: string;
  sitioB: string;
  porVariable: Record<VariableAnalogo, number>;
  correlacionTemporal: Record<'temperatura' | 'luz' | 'viento' | 'presion', number | null>;
  total: number;
  mediaSimple: number;
  peorCritica: { variable: VariableAnalogo; valor: number };
  penalizado: boolean;
  ventana: [number, number];
  modo: ModoComparacion;
  n: number;
  seriesA: SerieTemporal;
  seriesB: SerieTemporal;
  tvAire: number;
  tvSuelo: number;
}

export const SITIOS_INICIALES: SitioAmbiental[] = [
  {
    id: 'tierra-atacama',
    nombre: 'Tierra (Atacama, 2400 m)',
    esTierra: true,
    lat: -24.1,
    lon: -69.9,
    fuenteDatos: 'Modelo analogo.py',
    usarSerieMedida: false,
    serieMedida: null,
    periodo: 24.0,
    T: [290, 12],
    P: [75000, 0.005],
    viento: [4, 0.5],
    luz: [1100, null],
    g: 9.81,
    radiacion: 0.05,
    aire: { N2: 0.78, O2: 0.21, Ar: 0.0093, CO2: 0.0004, otros: 0.0003 },
    suelo: { SiO2: 0.6, Al2O3: 0.15, Fe2O3: 0.06, CaO: 0.05, MgO: 0.03, otros: 0.11 },
    pendiente: 5,
    rugosidad: 0.03,
  },
  {
    id: 'marte-gale',
    nombre: 'Marte (Cráter Gale)',
    lat: -4.5,
    periodo: 24.66,
    T: [218, 45],
    P: [750, 0.05],
    viento: [4, 0.6],
    luz: [500, null],
    g: 3.71,
    radiacion: 28,
    aire: { N2: 0.027, O2: 0.0013, Ar: 0.016, CO2: 0.953, otros: 0.0027 },
    suelo: { SiO2: 0.43, Al2O3: 0.09, Fe2O3: 0.19, CaO: 0.07, MgO: 0.09, otros: 0.13 },
    pendiente: 5,
    rugosidad: 0.05,
  },
  {
    id: 'luna-mare',
    nombre: 'Luna (ecuador, mare)',
    lat: 0.0,
    periodo: 708.7,
    T: [245, 145],
    P: [3e-10, 0.0],
    viento: [0, 0.0],
    luz: [1361, null],
    g: 1.62,
    radiacion: 60,
    aire: { N2: 0, O2: 0, Ar: 0.35, CO2: 0, otros: 0.65 },
    suelo: { SiO2: 0.45, Al2O3: 0.14, Fe2O3: 0.17, CaO: 0.12, MgO: 0.08, otros: 0.04 },
    pendiente: 5,
    rugosidad: 0.04,
  },
];

export const ESCALAS_DEFAULT: Record<VariableContinua, number> = {
  temperatura: 60.0,
  presion: 3.0,
  viento: 15.0,
  luz: 700.0,
  gravedad: 9.81,
  radiacion: 2.0,
};

export const PESOS_DEFAULT: Record<VariableAnalogo, number> = {
  temperatura: 2,
  presion: 3,
  viento: 1,
  luz: 1.5,
  gravedad: 2,
  radiacion: 1.5,
  aire: 3,
  suelo: 2,
  terreno: 1,
};

export const CRITICAS_DEFAULT: VariableAnalogo[] = ['presion', 'gravedad', 'aire'];

export const METADATOS_VARIABLES: Record<
  VariableAnalogo,
  {
    etiqueta: string;
    unidad: string;
    transformacion: string;
  }
> = {
  temperatura: { etiqueta: 'Temperatura', unidad: 'K', transformacion: 'Lineal (K)' },
  presion: { etiqueta: 'Presión', unidad: 'Pa', transformacion: 'log₁₀(máx(P, 10⁻¹²))' },
  viento: { etiqueta: 'Viento', unidad: 'm/s', transformacion: 'Lineal (m/s)' },
  luz: { etiqueta: 'Irradiancia', unidad: 'W/m²', transformacion: 'Lineal (W/m²)' },
  gravedad: { etiqueta: 'Gravedad', unidad: 'm/s²', transformacion: 'Lineal (m/s²)' },
  radiacion: { etiqueta: 'Radiación', unidad: 'µSv/h', transformacion: 'log₁₀(máx(R, 10⁻⁴))' },
  aire: { etiqueta: 'Aire / Exosfera', unidad: 'fracción', transformacion: '1 − distancia TV' },
  suelo: { etiqueta: 'Suelo / Regolito', unidad: 'fracción', transformacion: '1 − distancia TV' },
  terreno: { etiqueta: 'Terreno', unidad: '° / m', transformacion: 'Pendiente + rugosidad' },
};

export const ORDEN_VARIABLES: VariableAnalogo[] = [
  'temperatura',
  'presion',
  'viento',
  'luz',
  'gravedad',
  'radiacion',
  'aire',
  'suelo',
  'terreno',
];

function transformar(nombre: VariableContinua, x: number): number {
  if (nombre === 'presion') {
    return Math.log10(Math.max(x, 1e-12));
  }
  if (nombre === 'radiacion') {
    return Math.log10(Math.max(x, 1e-4));
  }
  return x;
}

export function linspace(inicio: number, fin: number, n: number): number[] {
  if (n <= 1) return [inicio];
  const out: number[] = new Array(n);
  const paso = (fin - inicio) / (n - 1);
  for (let i = 0; i < n; i++) {
    out[i] = inicio + paso * i;
  }
  return out;
}

function interpolarSerieHoraria(valores: number[], tHora: number): number {
  const len = valores.length;
  if (len === 0) return 0;
  if (len === 1) return valores[0];
  const tWrapped = ((tHora % len) + len) % len;
  const idx0 = Math.floor(tWrapped) % len;
  const idx1 = (idx0 + 1) % len;
  const frac = tWrapped - Math.floor(tWrapped);
  return valores[idx0] * (1 - frac) + valores[idx1] * frac;
}

export function generarSerie(
  sitio: SitioAmbiental,
  horas: [number, number],
  n = 240
): SerieTemporal {
  const t = linspace(horas[0], horas[1], n);
  const temperatura = new Array<number>(n);
  const presion = new Array<number>(n);
  const viento = new Array<number>(n);
  const luz = new Array<number>(n);
  const gravedad = new Array<number>(n);
  const radiacion = new Array<number>(n);

  if (sitio.usarSerieMedida && sitio.serieMedida && sitio.serieMedida.horas.length >= 2) {
    const m = sitio.serieMedida;
    const tMean =
      m.temperaturaK.reduce((acc, v) => acc + v, 0) / m.temperaturaK.length;
    const desp = sitio.desplazamientoTemp;
    for (let i = 0; i < n; i++) {
      const tRaw = interpolarSerieHoraria(m.temperaturaK, t[i]);
      temperatura[i] = desp
        ? Math.max(20, tMean + desp.deltaMedia + (tRaw - tMean) * desp.factorAmplitud)
        : tRaw;
      presion[i] = interpolarSerieHoraria(m.presionPa, t[i]);
      viento[i] = interpolarSerieHoraria(m.vientoMs, t[i]);
      luz[i] = interpolarSerieHoraria(m.luzWm2, t[i]);
      gravedad[i] = sitio.g;
      radiacion[i] = sitio.radiacion;
    }
    return { t, temperatura, presion, viento, luz, gravedad, radiacion };
  }

  for (let i = 0; i < n; i++) {
    const fase = (2 * Math.PI * t[i]) / Math.max(sitio.periodo, 1e-6);
    const c = -Math.cos(fase);
    temperatura[i] = sitio.T[0] + sitio.T[1] * c;
    presion[i] = sitio.P[0] * (1 + sitio.P[1] * c);
    viento[i] = Math.max(0, sitio.viento[0] * (1 + sitio.viento[1] * Math.sin(fase)));
    luz[i] = sitio.luz[0] * Math.max(0, c);
    gravedad[i] = sitio.g;
    radiacion[i] = sitio.radiacion;
  }

  return { t, temperatura, presion, viento, luz, gravedad, radiacion };
}

export function simSerie(
  a: number[],
  b: number[],
  nombre: VariableContinua,
  escalas: Record<VariableContinua, number> = ESCALAS_DEFAULT
): number {
  const escala = escalas[nombre];
  const qa = a.map((v) => transformar(nombre, v)).sort((x, y) => x - y);
  const qb = b.map((v) => transformar(nombre, v)).sort((x, y) => x - y);
  let suma = 0;
  for (let i = 0; i < qa.length; i++) {
    suma += Math.abs(qa[i] - qb[i]);
  }
  const d = suma / qa.length;
  return 100 * Math.max(0.0, 1 - d / escala);
}

export function simForma(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n === 0) return null;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;

  let va = 0;
  let vb = 0;
  let cov = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    va += da * da;
    vb += db * db;
    cov += da * db;
  }
  const sa = Math.sqrt(va / n);
  const sb = Math.sqrt(vb / n);
  if (sa < 1e-12 || sb < 1e-12) return null;
  return cov / n / (sa * sb);
}

export function distanciaTV(p: Record<string, number>, q: Record<string, number>): number {
  const claves = new Set([...Object.keys(p), ...Object.keys(q)]);
  const sp = Object.values(p).reduce((acc, v) => acc + v, 0) || 1;
  const sq = Object.values(q).reduce((acc, v) => acc + v, 0) || 1;
  let suma = 0;
  for (const k of claves) {
    suma += Math.abs((p[k] ?? 0) / sp - (q[k] ?? 0) / sq);
  }
  return 0.5 * suma;
}

export function simComp(p: Record<string, number>, q: Record<string, number>): number {
  return 100 * (1 - distanciaTV(p, q));
}

export function simTerreno(a: SitioAmbiental, b: SitioAmbiental): number {
  const ds = Math.abs(a.pendiente - b.pendiente) / 30;
  const dr = Math.abs(a.rugosidad - b.rugosidad) / 0.2;
  return 100 * Math.max(0, 1 - 0.5 * (ds + dr));
}

export function compararSitios(
  sitioA: SitioAmbiental,
  sitioB: SitioAmbiental,
  opciones?: {
    horas?: [number, number];
    modo?: ModoComparacion;
    n?: number;
    pesos?: Record<VariableAnalogo, number>;
    criticas?: VariableAnalogo[];
    escalas?: Record<VariableContinua, number>;
  }
): ResultadoComparacion {
  const horas: [number, number] = opciones?.horas ?? [0, 48];
  const modo: ModoComparacion = opciones?.modo ?? 'reloj';
  const n = Math.max(24, Math.min(2000, opciones?.n ?? 240));
  const pesos = opciones?.pesos ?? PESOS_DEFAULT;
  const criticas = opciones?.criticas ?? CRITICAS_DEFAULT;
  const escalas = opciones?.escalas ?? ESCALAS_DEFAULT;

  const seriesA =
    modo === 'ciclo'
      ? generarSerie(sitioA, [0, sitioA.periodo], n)
      : generarSerie(sitioA, horas, n);
  const seriesB =
    modo === 'ciclo'
      ? generarSerie(sitioB, [0, sitioB.periodo], n)
      : generarSerie(sitioB, horas, n);

  const tvAire = distanciaTV(sitioA.aire, sitioB.aire);
  const tvSuelo = distanciaTV(sitioA.suelo, sitioB.suelo);

  const porVariable: Record<VariableAnalogo, number> = {
    temperatura: simSerie(seriesA.temperatura, seriesB.temperatura, 'temperatura', escalas),
    presion: simSerie(seriesA.presion, seriesB.presion, 'presion', escalas),
    viento: simSerie(seriesA.viento, seriesB.viento, 'viento', escalas),
    luz: simSerie(seriesA.luz, seriesB.luz, 'luz', escalas),
    gravedad: simSerie(seriesA.gravedad, seriesB.gravedad, 'gravedad', escalas),
    radiacion: simSerie(seriesA.radiacion, seriesB.radiacion, 'radiacion', escalas),
    aire: 100 * (1 - tvAire),
    suelo: 100 * (1 - tvSuelo),
    terreno: simTerreno(sitioA, sitioB),
  };

  const correlacionTemporal = {
    temperatura: simForma(seriesA.temperatura, seriesB.temperatura),
    luz: simForma(seriesA.luz, seriesB.luz),
    viento: simForma(seriesA.viento, seriesB.viento),
    presion: simForma(seriesA.presion, seriesB.presion),
  };

  let sumaPonderada = 0;
  let sumaPesos = 0;
  for (const k of ORDEN_VARIABLES) {
    const w = Math.max(0, pesos[k] ?? 0);
    sumaPonderada += porVariable[k] * w;
    sumaPesos += w;
  }
  const mediaSimple = sumaPesos > 0 ? sumaPonderada / sumaPesos : 0;

  const listaCriticas = criticas.length > 0 ? criticas : CRITICAS_DEFAULT;
  let peorVar = listaCriticas[0];
  let peorVal = porVariable[peorVar];
  for (const k of listaCriticas) {
    if (porVariable[k] < peorVal) {
      peorVal = porVariable[k];
      peorVar = k;
    }
  }

  const penalizadoValor = 0.5 * mediaSimple + 0.5 * peorVal;
  const penalizado = penalizadoValor < mediaSimple;
  const total = Math.min(mediaSimple, penalizadoValor);

  return {
    sitioA: sitioA.nombre,
    sitioB: sitioB.nombre,
    porVariable,
    correlacionTemporal,
    total,
    mediaSimple,
    peorCritica: { variable: peorVar, valor: peorVal },
    penalizado,
    ventana: horas,
    modo,
    n,
    seriesA,
    seriesB,
    tvAire,
    tvSuelo,
  };
}

export function formatearInformeTexto(r: ResultadoComparacion): string {
  const lineas: string[] = [];
  lineas.push(
    `${r.sitioA}  vs  ${r.sitioB}   | ventana (${r.ventana[0]}, ${r.ventana[1]}) h | modo ${r.modo}`
  );
  lineas.push('-'.repeat(62));
  for (const k of ORDEN_VARIABLES) {
    const v = r.porVariable[k];
    const c =
      k === 'temperatura' || k === 'luz' || k === 'viento' || k === 'presion'
        ? r.correlacionTemporal[k]
        : null;
    const valStr = v.toFixed(1).padStart(5, ' ');
    const extra =
      c !== null && c !== undefined
        ? `  (forma temporal r=${c >= 0 ? '+' : ''}${c.toFixed(2)})`
        : '';
    lineas.push(`${k.padEnd(12, ' ')}${valStr} %${extra}`);
  }
  lineas.push('-'.repeat(62));
  lineas.push(
    `${'TOTAL'.padEnd(12, ' ')}${r.total.toFixed(1).padStart(5, ' ')} %   (media ponderada ${r.mediaSimple.toFixed(1)} %)`
  );
  return lineas.join('\n');
}

export function formatoCientifico(v: number, unidad?: string): string {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs < 1e-3 || abs >= 1e5) {
    return v.toExponential(2);
  }
  if (unidad === 'Pa' && abs >= 100) {
    return v.toFixed(0);
  }
  if (abs >= 100) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(2);
  return v.toFixed(3);
}
