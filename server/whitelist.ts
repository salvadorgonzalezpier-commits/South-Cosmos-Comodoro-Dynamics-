import * as db from './db.ts';

export type CategoriaOficial = 'NASA' | 'PDS' | 'ESA' | 'USGS' | 'NOAA' | 'Oficial';

export interface DominioListaBlanca {
  id: number;
  dominio: string;
  etiqueta: string;
  categoria: CategoriaOficial;
  activo: number;
  auto_entrenar: number;
  creado_en: number;
}

const SEMILLA_OFICIAL: Array<{
  dominio: string;
  etiqueta: string;
  categoria: CategoriaOficial;
}> = [
  {
    dominio: 'nasa.gov',
    etiqueta: 'NASA Oficial (Earthdata · POWER · Mars · Science)',
    categoria: 'NASA',
  },
  {
    dominio: 'pds.nasa.gov',
    etiqueta: 'NASA PDS (Planetary Data System)',
    categoria: 'PDS',
  },
  {
    dominio: 'pds-geosciences.wustl.edu',
    etiqueta: 'WUSTL PDS Geosciences Node (LRO · MGS · MRO · InSight)',
    categoria: 'PDS',
  },
  {
    dominio: 'rsl.wustl.edu',
    etiqueta: 'WUSTL Orbital Data Explorer (ODE REST)',
    categoria: 'PDS',
  },
  {
    dominio: 'jpl.nasa.gov',
    etiqueta: 'NASA JPL (Mars 2020 · MSL · Trek)',
    categoria: 'NASA',
  },
  {
    dominio: 'usgs.gov',
    etiqueta: 'USGS Astrogeology Science Center',
    categoria: 'USGS',
  },
  {
    dominio: 'esa.int',
    etiqueta: 'ESA Planetary Science Archive (PSA)',
    categoria: 'ESA',
  },
  {
    dominio: 'noaa.gov',
    etiqueta: 'NOAA NCEI (Atmósfera y Clima Terrestre)',
    categoria: 'NOAA',
  },
];

export function normalizarDominio(entrada: string): string | null {
  const raw = entrada.trim();
  if (!raw) return null;
  try {
    const conEsquema = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(conEsquema);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (!host || !host.includes('.') || host.length > 160) return null;
    return host;
  } catch {
    return null;
  }
}

export function asegurarSemillaListaBlanca(): void {
  db.iniciar();
  const c = db.getDb();
  const row = c.prepare('SELECT COUNT(*) AS n FROM lista_blanca').get() as { n: number };
  if (row.n > 0) return;

  const stmt = c.prepare(
    `INSERT OR IGNORE INTO lista_blanca(dominio, etiqueta, categoria, activo, auto_entrenar, creado_en)
     VALUES(?, ?, ?, 1, 1, ?)`
  );
  const now = Date.now() / 1000;
  for (const item of SEMILLA_OFICIAL) {
    stmt.run(item.dominio, item.etiqueta, item.categoria, now);
  }
}

export function listarListaBlanca(): DominioListaBlanca[] {
  asegurarSemillaListaBlanca();
  return db
    .getDb()
    .prepare('SELECT * FROM lista_blanca ORDER BY id ASC')
    .all() as unknown as DominioListaBlanca[];
}

export function verificarEnListaBlanca(urlODominio: string): {
  enListaBlanca: boolean;
  dominioDetectado: string | null;
  entrada: DominioListaBlanca | null;
} {
  const host = normalizarDominio(urlODominio);
  if (!host) {
    return { enListaBlanca: false, dominioDetectado: null, entrada: null };
  }

  const lista = listarListaBlanca().filter((d) => d.activo === 1);
  // Coincidencia exacta o subdominio (ordenando por longitud descendente para preferir el más específico)
  const ordenada = [...lista].sort((a, b) => b.dominio.length - a.dominio.length);
  const match =
    ordenada.find((d) => host === d.dominio || host.endsWith(`.${d.dominio}`)) ?? null;

  return {
    enListaBlanca: Boolean(match),
    dominioDetectado: host,
    entrada: match,
  };
}

export function agregarDominio(params: {
  dominio: string;
  etiqueta?: string;
  categoria?: CategoriaOficial;
  autoEntrenar?: boolean;
}): DominioListaBlanca {
  asegurarSemillaListaBlanca();
  const norm = normalizarDominio(params.dominio);
  if (!norm) {
    throw new Error('Dominio o URL inválido (ej. astrogeology.usgs.gov).');
  }
  const categoria: CategoriaOficial =
    params.categoria &&
    ['NASA', 'PDS', 'ESA', 'USGS', 'NOAA', 'Oficial'].includes(params.categoria)
      ? params.categoria
      : 'Oficial';
  const etiqueta = (params.etiqueta ?? '').trim() || `Fuente oficial (${norm})`;
  const autoEntrenar = params.autoEntrenar !== false ? 1 : 0;

  const c = db.getDb();
  c.prepare(
    `INSERT INTO lista_blanca(dominio, etiqueta, categoria, activo, auto_entrenar, creado_en)
     VALUES(?, ?, ?, 1, ?, ?)
     ON CONFLICT(dominio) DO UPDATE SET
       etiqueta = excluded.etiqueta,
       categoria = excluded.categoria,
       activo = 1,
       auto_entrenar = excluded.auto_entrenar`
  ).run(norm, etiqueta, categoria, autoEntrenar, Date.now() / 1000);

  return c
    .prepare('SELECT * FROM lista_blanca WHERE dominio = ?')
    .get(norm) as unknown as DominioListaBlanca;
}

export function actualizarEstadoDominio(
  id: number,
  cambios: { activo?: boolean; autoEntrenar?: boolean }
): DominioListaBlanca | null {
  asegurarSemillaListaBlanca();
  const c = db.getDb();
  if (typeof cambios.activo === 'boolean') {
    c.prepare('UPDATE lista_blanca SET activo = ? WHERE id = ?').run(
      cambios.activo ? 1 : 0,
      id
    );
  }
  if (typeof cambios.autoEntrenar === 'boolean') {
    c.prepare('UPDATE lista_blanca SET auto_entrenar = ? WHERE id = ?').run(
      cambios.autoEntrenar ? 1 : 0,
      id
    );
  }
  return (
    (c.prepare('SELECT * FROM lista_blanca WHERE id = ?').get(id) as unknown as DominioListaBlanca) ??
    null
  );
}

export function eliminarDominio(id: number): void {
  asegurarSemillaListaBlanca();
  db.getDb().prepare('DELETE FROM lista_blanca WHERE id = ?').run(id);
}
