import * as db from './db.ts';
import * as ml from './ml.ts';
import {
  ANALOGOS_LUNA_MARTE_PDS,
  ANALOGOS_TERRESTRES_NASA,
  PESOS_DEFAULT,
  SITIOS_INICIALES,
  SitioAmbiental,
  generarSerie,
  simSerie,
} from '../src/lib/analogo.ts';

function makeRng(seed: number) {
  let a = (seed + 0x9e3779b9) >>> 0;
  const rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const uniform = (lo: number, hi: number) => lo + (hi - lo) * rand();
  const normal = (mean = 0, std = 1) => {
    const u1 = Math.max(1e-12, rand());
    const u2 = rand();
    return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  return { uniform, normal };
}

function obtenerSitiosParaMl(): SitioAmbiental[] {
  const baseTierra = SITIOS_INICIALES[0];
  const baseMarte = SITIOS_INICIALES[1];
  const baseLuna = SITIOS_INICIALES[2];

  const tierraSitios: SitioAmbiental[] = ANALOGOS_TERRESTRES_NASA.map((t) => ({
    id: t.id,
    nombre: t.etiquetaSitio,
    esTierra: true,
    lat: t.lat,
    lon: t.lon,
    fuenteDatos: 'NASA Earthdata / analogo.py',
    periodo: t.periodo,
    T: [...t.T],
    P: [...t.P],
    viento: [...t.viento],
    luz: [...t.luz],
    g: baseTierra.g,
    radiacion: t.radiacion,
    aire: { ...baseTierra.aire },
    suelo: { ...t.suelo },
    pendiente: t.pendiente,
    rugosidad: t.rugosidad,
  }));

  const pdsSitios: SitioAmbiental[] = ANALOGOS_LUNA_MARTE_PDS.map((p) => {
    const ref = p.cuerpo === 'luna' ? baseLuna : baseMarte;
    return {
      id: p.id,
      nombre: p.etiquetaSitio,
      lat: p.lat,
      lon: p.lon,
      fuenteDatos: p.misionFuente,
      periodo: p.periodo,
      T: [...p.T],
      P: [...p.P],
      viento: [...p.viento],
      luz: [...p.luz],
      g: p.g,
      radiacion: p.radiacion,
      aire: { ...ref.aire },
      suelo: { ...p.suelo },
      pendiente: p.pendiente,
      rugosidad: p.rugosidad,
    };
  });

  return [...SITIOS_INICIALES, ...tierraSitios, ...pdsSitios];
}

export function sembrar(seed = 0): number {
  db.iniciar();
  const rng = makeRng(seed);
  const sitiosTodos = obtenerSitiosParaMl();
  let insertados = 0;

  for (const s of sitiosTodos) {
    const esBase =
      s.id === 'tierra-atacama' || s.id === 'marte-gale' || s.id === 'luna-mare';
    const muestras = esBase ? 60 : 28;
    const maxHora = s.periodo > 100 ? s.periodo : 100;

    for (let i = 0; i < muestras; i++) {
      const h = rng.uniform(0, maxHora);
      const ser = generarSerie(s, [h, h], 1);
      const y: Record<string, number> = {
        temperatura: Math.max(0.1, ser.temperatura[0] * (1 + rng.normal(0, 0.01))),
        presion: Math.max(1e-12, ser.presion[0] * (1 + rng.normal(0, 0.01))),
        viento: Math.max(0, ser.viento[0] * (1 + rng.normal(0, 0.01))),
        luz: Math.max(0, Math.min(1500, ser.luz[0] * (1 + rng.normal(0, 0.01)))),
      };
      const est = db.guardar(
        'clima',
        { sitio: s.nombre, hora: h },
        y,
        'editor',
        s.id === 'tierra-atacama' || s.id === 'marte-gale' || s.id === 'luna-mare'
          ? 'semilla analogo.py'
          : `semilla ${s.fuenteDatos ?? 'NASA'}`,
        '',
        1.0
      );
      if (est !== 'duplicado') insertados++;
    }
  }

  const pesoClimaTotal =
    PESOS_DEFAULT.temperatura +
    PESOS_DEFAULT.presion +
    PESOS_DEFAULT.viento +
    PESOS_DEFAULT.luz;

  for (const a of sitiosTodos) {
    for (const b of sitiosTodos) {
      const ambosBase =
        ['tierra-atacama', 'marte-gale', 'luna-mare'].includes(a.id) &&
        ['tierra-atacama', 'marte-gale', 'luna-mare'].includes(b.id);
      const paresN = ambosBase ? 15 : 1;

      for (let i = 0; i < paresN; i++) {
        const t0 = rng.uniform(0, 200);
        const ven: [number, number] = [t0, t0 + rng.uniform(24, 72)];
        const A = generarSerie(a, ven, 180);
        const B = generarSerie(b, ven, 180);

        const y: Record<string, number> = {
          temperatura: simSerie(A.temperatura, B.temperatura, 'temperatura'),
          presion: simSerie(A.presion, B.presion, 'presion'),
          viento: simSerie(A.viento, B.viento, 'viento'),
          luz: simSerie(A.luz, B.luz, 'luz'),
        };
        y.total =
          (y.temperatura * PESOS_DEFAULT.temperatura +
            y.presion * PESOS_DEFAULT.presion +
            y.viento * PESOS_DEFAULT.viento +
            y.luz * PESOS_DEFAULT.luz) /
          pesoClimaTotal;

        const mean = (arr: number[]) => arr.reduce((p, q) => p + q, 0) / arr.length;
        const x = {
          a: [mean(A.temperatura), mean(A.presion), mean(A.viento), mean(A.luz)],
          b: [mean(B.temperatura), mean(B.presion), mean(B.viento), mean(B.luz)],
        };

        const est = db.guardar(
          'similitud',
          x,
          y,
          'editor',
          ambosBase ? 'semilla analogo.py' : 'semilla PDS + analogo.py',
          '',
          1.0
        );
        if (est !== 'duplicado') insertados++;
      }
    }
  }

  return insertados;
}

/**
 * Conector autónomo oficial NASA (auto-aprobado por estar en db.OFICIALES = {'NASA', ...}).
 * Descarga observaciones horarias reales de NASA POWER (MERRA-2 / CERES) para Atacama
 * y alimenta tanto 'clima' como 'similitud' manteniendo el tope de peso autónomo <= 40 %.
 */
export async function conectorNasaPower(
  lat = -24.1,
  lon = -69.9,
  start = '20260615',
  end = '20260616'
): Promise<{ insertados: number; error?: string }> {
  try {
    const url = new URL('https://power.larc.nasa.gov/api/temporal/hourly/point');
    url.searchParams.set('parameters', 'T2M,PS,WS10M,ALLSKY_SFC_SW_DWN');
    url.searchParams.set('community', 'RE');
    url.searchParams.set('longitude', lon.toFixed(4));
    url.searchParams.set('latitude', lat.toFixed(4));
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);
    url.searchParams.set('format', 'JSON');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'AnalogoPlanetario/1.0' },
    });
    if (!res.ok) {
      return { insertados: 0, error: `NASA POWER HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      properties?: { parameter?: Record<string, Record<string, number>> };
    };
    const params = data.properties?.parameter;
    if (!params?.T2M) {
      return { insertados: 0, error: 'Respuesta incompleta de NASA POWER' };
    }

    const keys = Object.keys(params.T2M).sort();
    let insertados = 0;

    const tSeries: number[] = [];
    const pSeries: number[] = [];
    const wSeries: number[] = [];
    const lSeries: number[] = [];

    for (let idx = 0; idx < keys.length; idx++) {
      const k = keys[idx];
      const tC = params.T2M[k];
      const pKpa = params.PS?.[k];
      const w = params.WS10M?.[k];
      const l = params.ALLSKY_SFC_SW_DWN?.[k];
      if (
        tC === undefined ||
        pKpa === undefined ||
        w === undefined ||
        l === undefined ||
        tC <= -900 ||
        pKpa <= -900 ||
        w <= -900 ||
        l <= -900
      ) {
        continue;
      }

      const tK = tC + 273.15;
      const pPa = pKpa * 1000;
      const viento = Math.max(0, w);
      const luz = Math.max(0, Math.min(1500, l));

      tSeries.push(tK);
      pSeries.push(pPa);
      wSeries.push(viento);
      lSeries.push(luz);

      // Hora local aproximada en Atacama (UTC - 4h) para alinear con el ciclo solar
      const horaUtc = Number(k.slice(8, 10));
      const horaLocal = (horaUtc - 4 + 24) % 24;

      const est = db.guardar(
        'clima',
        { sitio: 'Tierra (Atacama, 2400 m)', hora: horaLocal + idx * 0.0001 },
        { temperatura: tK, presion: pPa, viento, luz },
        'autonomo',
        'NASA',
        url.toString(),
        0.92
      );
      if (est !== 'duplicado') insertados++;
    }

    // También genera registros de similitud reales NASA Tierra vs Marte y Luna
    if (tSeries.length >= 24) {
      const n = tSeries.length;
      const pesoClimaTotal =
        PESOS_DEFAULT.temperatura +
        PESOS_DEFAULT.presion +
        PESOS_DEFAULT.viento +
        PESOS_DEFAULT.luz;
      const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

      for (const otro of SITIOS_INICIALES.slice(1)) {
        const B = generarSerie(otro, [0, n], n);
        const y: Record<string, number> = {
          temperatura: simSerie(tSeries, B.temperatura, 'temperatura'),
          presion: simSerie(pSeries, B.presion, 'presion'),
          viento: simSerie(wSeries, B.viento, 'viento'),
          luz: simSerie(lSeries, B.luz, 'luz'),
        };
        y.total =
          (y.temperatura * PESOS_DEFAULT.temperatura +
            y.presion * PESOS_DEFAULT.presion +
            y.viento * PESOS_DEFAULT.viento +
            y.luz * PESOS_DEFAULT.luz) /
          pesoClimaTotal;

        const est = db.guardar(
          'similitud',
          {
            a: [mean(tSeries), mean(pSeries), mean(wSeries), mean(lSeries)],
            b: [mean(B.temperatura), mean(B.presion), mean(B.viento), mean(B.luz)],
          },
          y,
          'autonomo',
          'NASA',
          url.toString(),
          0.92
        );
        if (est !== 'duplicado') insertados++;
      }
    }

    return { insertados };
  } catch (err) {
    return {
      insertados: 0,
      error: err instanceof Error ? err.message : 'Error en conector NASA',
    };
  }
}

function faltanSitiosEnDb(): boolean {
  const filasClima = db.filas('clima', 'aprobado');
  const presentes = new Set<string>();
  for (const r of filasClima) {
    try {
      const parsed = JSON.parse(r.x) as { sitio?: string };
      if (parsed.sitio) presentes.add(parsed.sitio);
    } catch {
      // ignorar filas con JSON inválido
    }
  }
  return ml.NOMBRES.some((nombre) => !presentes.has(nombre));
}

export async function ejecutarCiclo(opciones?: {
  sembrarSiVacio?: boolean;
  incluirNasa?: boolean;
  epocas?: number;
  miembros?: number;
  ocultas?: number;
  lat?: number;
  lon?: number;
  start?: string;
  end?: string;
}) {
  db.iniciar();
  let nuevosSemilla = 0;
  let nuevosNasa = 0;
  let errorNasa: string | undefined;

  const conteosPrevios = db.resumenConteos();
  if (
    opciones?.sembrarSiVacio !== false &&
    (conteosPrevios.aprobados < 20 || faltanSitiosEnDb())
  ) {
    nuevosSemilla = sembrar(0);
  }

  const usarNasa = Boolean(opciones?.incluirNasa);
  if (usarNasa) {
    const r = await conectorNasaPower(
      opciones?.lat ?? -24.1,
      opciones?.lon ?? -69.9,
      opciones?.start ?? '20260615',
      opciones?.end ?? '20260616'
    );
    nuevosNasa = r.insertados;
    errorNasa = r.error;
  }

  const entrenamiento = ml.entrenarTodo({
    epocas: opciones?.epocas,
    miembros: opciones?.miembros,
    ocultas: opciones?.ocultas,
  });
  const conteos = db.resumenConteos();
  const historial = db.historial(15);

  return {
    modo: usarNasa ? 'local + nasa' : 'local',
    nuevos: nuevosSemilla + nuevosNasa,
    nuevosSemilla,
    nuevosNasa,
    errorNasa,
    entrenamiento,
    conteos,
    historial,
  };
}
