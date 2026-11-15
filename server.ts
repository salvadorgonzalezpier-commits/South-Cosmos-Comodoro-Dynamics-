import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import * as db from './server/db.ts';
import * as ml from './server/ml.ts';
import * as ciclo from './server/ciclo.ts';
import * as whitelist from './server/whitelist.ts';
import * as verifier from './server/verifier.ts';
import * as mapsGrounding from './server/maps.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. NASA POWER (Earthdata / MERRA-2 + CERES) series horarias reales para Tierra
  app.get('/api/earthdata/power', async (req, res) => {
    try {
      const lat = Number(req.query.lat ?? -24.1);
      const lon = Number(req.query.lon ?? -69.9);
      const start = String(req.query.start ?? '20250110').replace(/[^0-9]/g, '');
      const end = String(req.query.end ?? '20250111').replace(/[^0-9]/g, '');

      if (
        Number.isNaN(lat) ||
        Number.isNaN(lon) ||
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180
      ) {
        return res.status(400).json({ error: 'Coordenadas geográficas inválidas.' });
      }
      if (start.length !== 8 || end.length !== 8) {
        return res.status(400).json({ error: 'Formato de fecha inválido (use YYYYMMDD).' });
      }

      const url = new URL('https://power.larc.nasa.gov/api/temporal/hourly/point');
      url.searchParams.set('parameters', 'T2M,PS,WS10M,ALLSKY_SFC_SW_DWN');
      url.searchParams.set('community', 'RE');
      url.searchParams.set('longitude', lon.toFixed(4));
      url.searchParams.set('latitude', lat.toFixed(4));
      url.searchParams.set('start', start);
      url.searchParams.set('end', end);
      url.searchParams.set('format', 'JSON');

      const upstream = await fetch(url.toString(), {
        headers: { 'User-Agent': 'AnalogoPlanetario/1.0' },
      });
      if (!upstream.ok) {
        const text = await upstream.text();
        return res.status(upstream.status).json({
          error: `NASA POWER respondió ${upstream.status}`,
          detail: text.slice(0, 300),
        });
      }

      const data = (await upstream.json()) as {
        geometry?: { coordinates?: [number, number, number] };
        properties?: {
          parameter?: Record<string, Record<string, number>>;
        };
      };

      const params = data.properties?.parameter;
      if (!params || !params.T2M) {
        return res.status(502).json({ error: 'Respuesta incompleta de NASA POWER.' });
      }

      const keys = Object.keys(params.T2M).sort();
      const fillOrKeep = (val: number | undefined, fallback: number) =>
        val === undefined || val <= -900 ? fallback : val;

      const horas: number[] = [];
      const etiquetas: string[] = [];
      const temperaturaK: number[] = [];
      const presionPa: number[] = [];
      const vientoMs: number[] = [];
      const luzWm2: number[] = [];

      let lastT = 285;
      let lastP = 75000;
      let lastW = 3;
      let lastL = 0;

      keys.forEach((k, idx) => {
        const tC = fillOrKeep(params.T2M?.[k], lastT - 273.15);
        const tK = tC + 273.15;
        lastT = tK;

        const pKpa = fillOrKeep(params.PS?.[k], lastP / 1000);
        const pPa = pKpa * 1000;
        lastP = pPa;

        const w = Math.max(0, fillOrKeep(params.WS10M?.[k], lastW));
        lastW = w;

        const l = Math.max(0, fillOrKeep(params.ALLSKY_SFC_SW_DWN?.[k], lastL));
        lastL = l;

        horas.push(idx);
        etiquetas.push(
          `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)} ${k.slice(8, 10)}:00 UTC`
        );
        temperaturaK.push(tK);
        presionPa.push(pPa);
        vientoMs.push(w);
        luzWm2.push(l);
      });

      const elevacionM = data.geometry?.coordinates?.[2] ?? null;

      return res.json({
        source: 'NASA POWER / Earthdata (MERRA-2 & CERES)',
        lat,
        lon,
        elevacionM,
        start,
        end,
        horas,
        etiquetas,
        temperaturaK,
        presionPa,
        vientoMs,
        luzWm2,
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Error consultando NASA POWER',
      });
    }
  });

  // 2. NASA Earthdata CMR API (search.earthdata.nasa.gov)
  app.get('/api/earthdata/cmr', async (req, res) => {
    try {
      const keyword = String(req.query.keyword ?? 'Atacama');
      const lat = req.query.lat !== undefined ? Number(req.query.lat) : null;
      const lon = req.query.lon !== undefined ? Number(req.query.lon) : null;
      const pageSize = Math.min(12, Math.max(1, Number(req.query.page_size ?? 6)));

      const url = new URL('https://cmr.earthdata.nasa.gov/search/collections.json');
      if (keyword.trim()) {
        url.searchParams.set('keyword', keyword.trim());
      }
      if (
        lat !== null &&
        lon !== null &&
        !Number.isNaN(lat) &&
        !Number.isNaN(lon)
      ) {
        url.searchParams.set('point', `${lon.toFixed(3)},${lat.toFixed(3)}`);
      }
      url.searchParams.set('page_size', String(pageSize));

      const upstream = await fetch(url.toString(), {
        headers: { 'User-Agent': 'AnalogoPlanetario/1.0' },
      });

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          error: `CMR Earthdata respondió ${upstream.status}`,
        });
      }

      const json = (await upstream.json()) as {
        feed?: {
          entry?: Array<{
            id: string;
            title?: string;
            short_name?: string;
            version_id?: string;
            data_center?: string;
            summary?: string;
            time_start?: string;
            time_end?: string;
          }>;
        };
      };

      const totalHits = Number(upstream.headers.get('cmr-hits') ?? 0);
      const entries = (json.feed?.entry ?? []).map((e) => ({
        id: e.id,
        title: e.title ?? e.short_name ?? e.id,
        shortName: e.short_name ?? '',
        versionId: e.version_id ?? '',
        dataCenter: e.data_center ?? '',
        summary: e.summary ?? '',
        timeStart: e.time_start ?? null,
        timeEnd: e.time_end ?? null,
        earthdataUrl: `https://search.earthdata.nasa.gov/search/granules?p=${encodeURIComponent(
          e.id
        )}`,
      }));

      return res.json({ totalHits, entries });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Error consultando NASA CMR',
      });
    }
  });

  // 3. NASA Worldview / GIBS WMS Snapshot Proxy
  app.get('/api/earthdata/worldview', async (req, res) => {
    try {
      const lat = Number(req.query.lat ?? -24.1);
      const lon = Number(req.query.lon ?? -69.9);
      const span = Math.min(20, Math.max(0.25, Number(req.query.span ?? 2.5)));
      const date = String(req.query.date ?? '2025-01-10').slice(0, 10);
      const layer = String(
        req.query.layer ?? 'MODIS_Terra_CorrectedReflectance_TrueColor'
      );

      const minLat = Math.max(-89.9, lat - span);
      const maxLat = Math.min(89.9, lat + span);
      const minLon = Math.max(-179.9, lon - span);
      const maxLon = Math.min(179.9, lon + span);

      const url = new URL('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi');
      url.searchParams.set('SERVICE', 'WMS');
      url.searchParams.set('REQUEST', 'GetMap');
      url.searchParams.set('VERSION', '1.3.0');
      url.searchParams.set('LAYERS', layer);
      url.searchParams.set('STYLES', '');
      url.searchParams.set('FORMAT', 'image/png');
      url.searchParams.set('CRS', 'EPSG:4326');
      url.searchParams.set(
        'BBOX',
        `${minLat.toFixed(4)},${minLon.toFixed(4)},${maxLat.toFixed(4)},${maxLon.toFixed(4)}`
      );
      url.searchParams.set('WIDTH', '720');
      url.searchParams.set('HEIGHT', '540');
      url.searchParams.set('TIME', date);

      const upstream = await fetch(url.toString(), {
        headers: { 'User-Agent': 'AnalogoPlanetario/1.0' },
      });

      const contentType = upstream.headers.get('content-type') ?? 'image/png';
      if (!upstream.ok || contentType.includes('xml') || contentType.includes('html')) {
        return res.status(502).json({
          error: 'No hay imagen GIBS/Worldview disponible para esa capa o fecha.',
        });
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(buf);
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Error descargando imagen Worldview',
      });
    }
  });

  // 3b. Google Maps Grounding (gemini-4-hydrogen + googleMaps tool)
  app.post('/api/earthdata/maps-grounding', async (req, res) => {
    try {
      const { consulta, lat = -24.1, lon = -69.9 } = req.body ?? {};
      const textoConsulta = String(consulta ?? '').trim();
      if (!textoConsulta) {
        return res.status(400).json({
          error: 'Describe el lugar o entorno geográfico a consultar en Google Maps.',
        });
      }

      const resultado = await mapsGrounding.consultarGoogleMapsGrounding({
        consulta: textoConsulta,
        lat: Number(lat),
        lon: Number(lon),
      });

      return res.json(resultado);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Error consultando Google Maps Grounding';
      const isQuota = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
      return res.status(isQuota ? 429 : 500).json({
        error: isQuota
          ? 'Límite temporal de cuota alcanzado en Google Maps Grounding. Intenta nuevamente en unos segundos.'
          : msg,
      });
    }
  });

  // 4. Endpoints de Base de Conocimiento y Ensambles MLP (ml.py / db.py / ciclo.py / app.py)
  const serializarEstadoModelo = (m: ml.Ensamble | null) =>
    m
      ? {
          entrenadoEn: m.entrenadoEn,
          perdidaMedia: m.perdidaMedia,
          nEditor: m.nEditor,
          nAutonomo: m.nAutonomo,
          miembros: m.ms.length,
          epocas: m.epocas,
          duracionMs: m.duracionMs,
          nIn: m.ms[0]?.nIn ?? 0,
        }
      : null;

  app.get('/api/ml/status', (_req, res) => {
    try {
      db.iniciar();
      const modeloClima = ml.cargarModelo('clima');
      const modeloSim = ml.cargarModelo('similitud');
      const conteos = db.resumenConteos();
      const historial = db.historial(15);
      const pendientes = db.filas(undefined, 'pendiente').slice(0, 30);

      return res.json({
        modelosListos: Boolean(modeloClima && modeloSim),
        sitiosSoportados: ml.NOMBRES,
        modelos: {
          clima: serializarEstadoModelo(modeloClima),
          similitud: serializarEstadoModelo(modeloSim),
        },
        conteos,
        historial,
        pendientes,
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Error leyendo estado ML',
      });
    }
  });

  app.post('/api/ml/train', async (req, res) => {
    try {
      const {
        sembrarSiVacio = true,
        incluirNasa = false,
        epocas = 1200,
        miembros = 3,
        ocultas = 24,
        lat = -24.1,
        lon = -69.9,
        start = '20260615',
        end = '20260616',
      } = req.body ?? {};

      const resultado = await ciclo.ejecutarCiclo({
        sembrarSiVacio: Boolean(sembrarSiVacio),
        incluirNasa: Boolean(incluirNasa),
        epocas: Number(epocas) || 1200,
        miembros: Number(miembros) || 3,
        ocultas: Number(ocultas) || 24,
        lat: Number(lat),
        lon: Number(lon),
        start: String(start).replace(/[^0-9]/g, ''),
        end: String(end).replace(/[^0-9]/g, ''),
      });

      const modeloClima = ml.cargarModelo('clima');
      const modeloSim = ml.cargarModelo('similitud');

      return res.json({
        ...resultado,
        modelosListos: Boolean(modeloClima && modeloSim),
        sitiosSoportados: ml.NOMBRES,
        modelos: {
          clima: serializarEstadoModelo(modeloClima),
          similitud: serializarEstadoModelo(modeloSim),
        },
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Error entrenando modelos',
      });
    }
  });

  app.post('/api/ml/predict', (req, res) => {
    try {
      const C = ml.cargarModelo('clima');
      const S = ml.cargarModelo('similitud');
      if (!C || !S) {
        return res.status(400).json({
          error: 'Aún no hay modelos entrenados. Ejecuta primero el entrenamiento.',
        });
      }

      const { sitioA, sitioB, t0 = 0, t1 = 48 } = req.body ?? {};
      const nombreA = ml.SITIOS_ML[sitioA] ? sitioA : ml.NOMBRES[0];
      const nombreB = ml.SITIOS_ML[sitioB] ? sitioB : ml.NOMBRES[1];
      const inicio = Number(t0) || 0;
      const fin = Math.max(inicio + 1, Number(t1) || 48);

      const predecirClimaVentana = (sitio: string) => {
        const nPts = 24;
        const paso = (fin - inicio) / (nPts - 1);
        const preds = Array.from({ length: nPts }, (_, i) =>
          C.predecir({ sitio, hora: inicio + paso * i })
        );
        const resumen: Record<string, { valor: number; incertidumbre: number }> = {};
        for (const k of ml.CLIMA_Y) {
          const vals = preds.map((p) => p[k].valor);
          const uncs = preds.map((p) => p[k].incertidumbre);
          resumen[k] = {
            valor: vals.reduce((a, b) => a + b, 0) / vals.length,
            incertidumbre: uncs.reduce((a, b) => a + b, 0) / uncs.length,
          };
        }
        return resumen;
      };

      const ca = predecirClimaVentana(nombreA);
      const cb = predecirClimaVentana(nombreB);
      const sim = S.predecir({
        a: ml.CLIMA_Y.map((k) => ca[k].valor),
        b: ml.CLIMA_Y.map((k) => cb[k].valor),
      });

      return res.json({ a: nombreA, b: nombreB, t0: inicio, t1: fin, ca, cb, sim });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Error generando predicción',
      });
    }
  });

  app.post('/api/ml/records', (req, res) => {
    try {
      const {
        tipo = 'clima',
        x,
        y,
        origen = 'editor',
        fuente = 'editor',
        url = '',
        confianza = 1.0,
        entrenarSiListaBlanca = false,
      } = req.body ?? {};

      if (tipo !== 'clima' && tipo !== 'similitud') {
        return res.status(400).json({ error: 'Tipo inválido (clima | similitud).' });
      }

      const xObj = typeof x === 'string' ? JSON.parse(x) : x;
      const yObj = typeof y === 'string' ? JSON.parse(y) : y;
      const urlStr = String(url || '');
      const wl = urlStr ? whitelist.verificarEnListaBlanca(urlStr) : null;
      const enListaBlanca = Boolean(wl?.enListaBlanca);

      const estado = db.guardar(
        tipo,
        xObj,
        yObj,
        origen === 'autonomo' ? 'autonomo' : 'editor',
        enListaBlanca && wl?.entrada ? wl.entrada.categoria : String(fuente || 'editor'),
        urlStr,
        enListaBlanca ? Math.max(0.95, Number(confianza ?? 0.95)) : Number(confianza ?? 1.0),
        enListaBlanca
      );

      let entrenamiento = null;
      if (enListaBlanca && entrenarSiListaBlanca && estado === 'aprobado') {
        entrenamiento = ml.entrenarTodo({ epocas: 800 });
      }

      return res.json({
        estado,
        enListaBlanca,
        dominioOficial: wl?.entrada?.dominio ?? null,
        entrenamiento,
        conteos: db.resumenConteos(),
        pendientes: db.filas(undefined, 'pendiente').slice(0, 30),
      });
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Error validando registro',
      });
    }
  });

  app.post('/api/ml/records/:id/estado', (req, res) => {
    try {
      const id = Number(req.params.id);
      const { estado } = req.body ?? {};
      if (estado !== 'aprobado' && estado !== 'rechazado') {
        return res.status(400).json({ error: 'Estado inválido.' });
      }
      db.cambiarEstado(id, estado);
      return res.json({
        ok: true,
        conteos: db.resumenConteos(),
        pendientes: db.filas(undefined, 'pendiente').slice(0, 30),
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Error actualizando estado',
      });
    }
  });

  // 4b. Lista blanca de páginas oficiales (sin verificación manual + auto-entrenamiento)
  app.get('/api/ml/whitelist', (_req, res) => {
    try {
      return res.json({
        dominios: whitelist.listarListaBlanca(),
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Error leyendo lista blanca',
      });
    }
  });

  app.post('/api/ml/whitelist', (req, res) => {
    try {
      const { dominio, etiqueta, categoria, autoEntrenar = true } = req.body ?? {};
      const item = whitelist.agregarDominio({
        dominio: String(dominio ?? ''),
        etiqueta: etiqueta ? String(etiqueta) : undefined,
        categoria,
        autoEntrenar: Boolean(autoEntrenar),
      });
      return res.json({ item, dominios: whitelist.listarListaBlanca() });
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Error agregando dominio a lista blanca',
      });
    }
  });

  app.patch('/api/ml/whitelist/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      const { activo, autoEntrenar } = req.body ?? {};
      const item = whitelist.actualizarEstadoDominio(id, {
        activo: typeof activo === 'boolean' ? activo : undefined,
        autoEntrenar: typeof autoEntrenar === 'boolean' ? autoEntrenar : undefined,
      });
      return res.json({ item, dominios: whitelist.listarListaBlanca() });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Error actualizando lista blanca',
      });
    }
  });

  app.delete('/api/ml/whitelist/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      whitelist.eliminarDominio(id);
      return res.json({ ok: true, dominios: whitelist.listarListaBlanca() });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Error eliminando dominio',
      });
    }
  });

  app.post('/api/ml/whitelist-ingest', (req, res) => {
    try {
      const {
        sitio,
        sourceUrl,
        hora = 12,
        temperatura,
        presion,
        viento,
        luz,
        entrenarAhora = true,
      } = req.body ?? {};

      const urlStr = String(sourceUrl ?? '').trim();
      if (!urlStr) {
        return res.status(400).json({ error: 'Indica la URL de la fuente de datos.' });
      }

      const wl = whitelist.verificarEnListaBlanca(urlStr);
      const sitioVal = String(sitio || 'Tierra (Atacama, 2400 m)');
      const x = { sitio: sitioVal, hora: Number(hora) || 12 };
      const y = {
        temperatura: Number(temperatura),
        presion: Number(presion),
        viento: Number(viento),
        luz: Number(luz),
      };

      const enListaBlanca = wl.enListaBlanca;
      const estado = db.guardar(
        'clima',
        x,
        y,
        'autonomo',
        enListaBlanca && wl.entrada ? wl.entrada.categoria : wl.dominioDetectado ?? 'externo',
        urlStr,
        enListaBlanca ? 0.96 : 0.55,
        enListaBlanca
      );

      let entrenamiento = null;
      const debeEntrenar =
        enListaBlanca &&
        estado === 'aprobado' &&
        Boolean(entrenarAhora) &&
        (wl.entrada?.auto_entrenar ?? 1) === 1;

      if (debeEntrenar) {
        entrenamiento = ml.entrenarTodo({ epocas: 800 });
      }

      return res.json({
        estado,
        enListaBlanca,
        dominioDetectado: wl.dominioDetectado,
        reglaMatch: wl.entrada,
        entrenamiento,
        conteos: db.resumenConteos(),
        pendientes: db.filas(undefined, 'pendiente').slice(0, 30),
      });
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Error ingiriendo observación',
      });
    }
  });

  // 4c. Verificación y extracción con Google Search Grounding (gemini-4-hydrogen)
  app.post('/api/ml/verify-search', async (req, res) => {
    try {
      const {
        consulta,
        sitio,
        sourceUrl,
        temperatura,
        presion,
        viento,
        luz,
        autoGuardar = false,
        autoEntrenar = false,
      } = req.body ?? {};

      if (!String(consulta ?? '').trim()) {
        return res.status(400).json({ error: 'Describe el dato o consulta a verificar.' });
      }

      const verificacion = await verifier.verificarConGoogleSearch({
        consulta: String(consulta),
        sitio: sitio ? String(sitio) : undefined,
        sourceUrl: sourceUrl ? String(sourceUrl) : undefined,
        temperatura: temperatura !== undefined && temperatura !== null && temperatura !== '' ? Number(temperatura) : null,
        presion: presion !== undefined && presion !== null && presion !== '' ? Number(presion) : null,
        viento: viento !== undefined && viento !== null && viento !== '' ? Number(viento) : null,
        luz: luz !== undefined && luz !== null && luz !== '' ? Number(luz) : null,
      });

      let estadoGuardado: string | null = null;
      let entrenamiento = null;

      if (
        autoGuardar &&
        verificacion.valores.temperatura !== null &&
        verificacion.valores.presion !== null &&
        verificacion.valores.viento !== null &&
        verificacion.valores.luz !== null
      ) {
        const aprobarDirecto =
          verificacion.enListaBlanca || (verificacion.verificado && verificacion.confianza >= 0.7);

        const fuentePrincipal =
          sourceUrl ||
          verificacion.fuentes.find((f) => f.enListaBlanca)?.uri ||
          verificacion.fuentes[0]?.uri ||
          'https://search.google.com/';

        estadoGuardado = db.guardar(
          'clima',
          {
            sitio: verificacion.sitioSugerido,
            hora: verificacion.valores.hora,
          },
          {
            temperatura: verificacion.valores.temperatura,
            presion: verificacion.valores.presion,
            viento: verificacion.valores.viento,
            luz: verificacion.valores.luz,
          },
          'autonomo',
          verificacion.enListaBlanca ? 'GoogleSearch+Oficial' : 'GoogleSearch',
          fuentePrincipal,
          verificacion.confianza,
          aprobarDirecto
        );

        if (autoEntrenar && estadoGuardado === 'aprobado') {
          entrenamiento = ml.entrenarTodo({ epocas: 800 });
        }
      }

      return res.json({
        verificacion,
        estadoGuardado,
        entrenamiento,
        conteos: db.resumenConteos(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error verificando con Google Search';
      const isQuota = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
      return res.status(isQuota ? 429 : 500).json({
        error: isQuota
          ? 'Límite temporal de cuota alcanzado en Google Search Grounding. Puedes usar una URL de la lista blanca oficial o reintentar más tarde.'
          : msg,
      });
    }
  });

  // 5. PDS Geosciences Node (WUSTL ODE REST API para LRO Luna y Marte)
  app.get('/api/pds/ode', async (req, res) => {
    try {
      const target = String(req.query.target ?? 'moon').toLowerCase() === 'mars' ? 'mars' : 'moon';
      const ihid = String(req.query.ihid ?? (target === 'moon' ? 'LRO' : 'MGS')).toUpperCase();
      const iid = String(req.query.iid ?? (target === 'moon' ? 'DLRE' : 'MOLA')).toUpperCase();
      const pt = String(req.query.pt ?? (target === 'moon' ? 'GDR_L2' : 'MEGDR')).toUpperCase();
      const lat = Number(req.query.lat ?? (target === 'moon' ? 0 : -4.5));
      const lon = Number(req.query.lon ?? (target === 'moon' ? 23.5 : 137.4));
      const span = Math.min(25, Math.max(1, Number(req.query.span ?? 6)));
      const limit = Math.min(10, Math.max(1, Number(req.query.limit ?? 6)));

      // ODE usa longitud este [0, 360]
      const normLon = ((lon % 360) + 360) % 360;
      const westLon = Math.max(0, normLon - span);
      const eastLon = Math.min(360, normLon + span);
      const minLat = Math.max(-90, lat - span);
      const maxLat = Math.min(90, lat + span);

      const url = new URL('https://oderest.rsl.wustl.edu/live2/');
      url.searchParams.set('target', target);
      url.searchParams.set('query', 'product');
      url.searchParams.set('results', 'm');
      url.searchParams.set('output', 'json');
      url.searchParams.set('ihid', ihid);
      url.searchParams.set('iid', iid);
      url.searchParams.set('pt', pt);
      url.searchParams.set('minlat', minLat.toFixed(2));
      url.searchParams.set('maxlat', maxLat.toFixed(2));
      url.searchParams.set('westlon', westLon.toFixed(2));
      url.searchParams.set('eastlon', eastLon.toFixed(2));
      url.searchParams.set('limit', String(limit));

      const upstream = await fetch(url.toString(), {
        headers: { 'User-Agent': 'AnalogoPlanetario/1.0' },
      });

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          error: `WUSTL ODE respondió ${upstream.status}`,
        });
      }

      const json = (await upstream.json()) as {
        ODEResults?: {
          Error?: string;
          Products?: {
            Product?: Record<string, unknown> | Array<Record<string, unknown>>;
          };
        };
      };

      if (json.ODEResults?.Error) {
        return res.json({
          target,
          ihid,
          iid,
          pt,
          warning: json.ODEResults.Error,
          products: [],
        });
      }

      const rawProd = json.ODEResults?.Products?.Product;
      const arr = !rawProd ? [] : Array.isArray(rawProd) ? rawProd : [rawProd];

      const products = arr.map((p) => ({
        name: String(p.Product_name ?? p.pdsid ?? 'Producto ODE'),
        description: String(p.Description ?? '').replace(/\s+/g, ' ').trim(),
        productUrl: String(p.ProductURL ?? p.External_url ?? ''),
        labelUrl: String(p.LabelURL ?? ''),
        filesUrl: String(p.FilesURL ?? ''),
        utcStart: p.UTC_start_time ? String(p.UTC_start_time) : null,
        utcStop: p.UTC_stop_time ? String(p.UTC_stop_time) : null,
        mapScale: p.Map_scale ? String(p.Map_scale) : null,
        centerLat: p.Center_latitude ? Number(p.Center_latitude) : null,
        centerLon: p.Center_longitude ? Number(p.Center_longitude) : null,
      }));

      return res.json({
        target,
        ihid,
        iid,
        pt,
        products,
        portalUrl:
          target === 'moon'
            ? 'https://pds-geosciences.wustl.edu/missions/lro/'
            : 'https://pds-geosciences.wustl.edu/missions/',
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Error consultando WUSTL ODE',
      });
    }
  });

  // 6. NASA Planetary Data System Search API (pds.nasa.gov)
  app.get('/api/pds/search', async (req, res) => {
    try {
      const target = String(req.query.target ?? 'Moon').toLowerCase() === 'mars' ? 'Mars' : 'Moon';
      const keyword = String(req.query.keyword ?? '').trim().toLowerCase();

      const url = new URL('https://pds.nasa.gov/api/search/1/classes/bundle');
      url.searchParams.set('limit', '100');
      url.searchParams.set('q', `(pds:Target_Identification.pds:name eq "${target}")`);

      const upstream = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'AnalogoPlanetario/1.0',
          Accept: 'application/json',
        },
      });

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          error: `NASA PDS API respondió ${upstream.status}`,
        });
      }

      const json = (await upstream.json()) as {
        summary?: { hits?: number };
        data?: Array<{
          id: string;
          properties?: Record<string, string[]>;
        }>;
      };

      const totalHits = json.summary?.hits ?? 0;
      const mapped = (json.data ?? []).map((item) => {
        const props = item.properties ?? {};
        const title =
          props['title']?.[0] ??
          props['pds:Identification_Area.pds:title']?.[0] ??
          item.id;
        const description =
          props['description']?.[0] ??
          props['pds:Bundle.pds:description']?.[0] ??
          '';
        const investigation =
          props['pds:Investigation_Area.pds:name']?.join(', ') ?? '';
        const nodeName = props['ops:Harvest_Info.ops:node_name']?.[0] ?? 'PDS';
        const startTime = props['pds:Time_Coordinates.pds:start_date_time']?.[0] ?? null;
        const stopTime = props['pds:Time_Coordinates.pds:stop_date_time']?.[0] ?? null;
        const labelRef = props['ops:Label_File_Info.ops:file_ref']?.[0] ?? '';
        const lid = props['lid']?.[0] ?? item.id.split('::')[0];

        return {
          id: item.id,
          lid,
          title,
          description: description.replace(/\s+/g, ' ').trim(),
          investigation,
          nodeName,
          startTime,
          stopTime,
          labelRef,
          pdsUrl: `https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=${encodeURIComponent(
            item.id
          )}`,
        };
      });

      const filtered = keyword
        ? mapped.filter(
            (b) =>
              b.title.toLowerCase().includes(keyword) ||
              b.id.toLowerCase().includes(keyword) ||
              b.investigation.toLowerCase().includes(keyword) ||
              b.description.toLowerCase().includes(keyword)
          )
        : mapped;

      return res.json({
        target,
        totalHits,
        matchedCount: filtered.length,
        bundles: filtered.slice(0, 6),
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Error consultando NASA PDS',
      });
    }
  });

  // 7. NASA Moon Trek & Mars Trek WMTS Orbital Tile Proxy (LRO / MOLA / Viking)
  app.get('/api/pds/trek', async (req, res) => {
    try {
      const body = String(req.query.body ?? 'Moon') === 'Mars' ? 'Mars' : 'Moon';
      const layer = String(
        req.query.layer ??
          (body === 'Moon'
            ? 'LRO_WAC_Mosaic_Global_303ppd_v02'
            : 'Mars_MGS_MOLA_ClrShade_merge_global_463m')
      );
      const lat = Math.max(-89.9, Math.min(89.9, Number(req.query.lat ?? 0)));
      const lon = Number(req.query.lon ?? 0);
      const maxLayerZoom =
        layer === 'LRO_LOLA_ClrShade_Global_128ppd_v04' ? 5 : 7;
      const z = Math.max(0, Math.min(maxLayerZoom, Math.floor(Number(req.query.z ?? 2))));

      const normLon = ((((lon + 180) % 360) + 360) % 360) - 180;
      const numCols = Math.pow(2, z + 1);
      const numRows = Math.pow(2, z);

      let col: number;
      if (req.query.col !== undefined && !Number.isNaN(Number(req.query.col))) {
        const rawCol = Math.floor(Number(req.query.col));
        col = ((rawCol % numCols) + numCols) % numCols;
      } else {
        col = Math.max(
          0,
          Math.min(numCols - 1, Math.floor(((normLon + 180) / 360) * numCols))
        );
      }

      let row: number;
      if (req.query.row !== undefined && !Number.isNaN(Number(req.query.row))) {
        row = Math.max(0, Math.min(numRows - 1, Math.floor(Number(req.query.row))));
      } else {
        row = Math.max(
          0,
          Math.min(numRows - 1, Math.floor(((90 - lat) / 180) * numRows))
        );
      }

      const ext =
        layer === 'LRO_LOLA_ClrShade_Global_128ppd_v04' ? 'png' : 'jpg';
      const tileUrl = `https://trek.nasa.gov/tiles/${body}/EQ/${encodeURIComponent(
        layer
      )}/1.0.0/default/default028mm/${z}/${row}/${col}.${ext}`;

      const upstream = await fetch(tileUrl, {
        headers: { 'User-Agent': 'AnalogoPlanetario/1.0' },
      });

      if (!upstream.ok) {
        return res.status(upstream.status === 404 ? 404 : 502).json({
          error: `NASA Trek tile respondió ${upstream.status}`,
        });
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader(
        'Content-Type',
        upstream.headers.get('content-type') ?? (ext === 'png' ? 'image/png' : 'image/jpeg')
      );
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buf);
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Error descargando tile de NASA Trek',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  db.iniciar();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
    if (!ml.cargarModelo('clima') || !ml.cargarModelo('similitud')) {
      console.log('Inicializando base de conocimiento y entrenando ensambles MLP...');
      ciclo
        .ejecutarCiclo({
          sembrarSiVacio: true,
          incluirNasa: true,
        })
        .then((initRes) => {
          console.log('Entrenamiento inicial completado:', initRes.entrenamiento);
        })
        .catch((err) => {
          console.error('Error en entrenamiento inicial:', err);
        });
    }
  });
}

startServer();
