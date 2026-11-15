import crypto from 'node:crypto';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const RUTA = process.env.DB_RUTA ?? path.resolve(process.cwd(), 'conocimiento.db');

export const OFICIALES = new Set(['NASA', 'NOAA', 'USGS', 'ESA']);

export const LIMITES: Record<string, [number, number]> = {
  temperatura: [0, 1000],
  presion: [0, 1e7],
  viento: [0, 150],
  luz: [0, 1500],
};

export type TipoModelo = 'clima' | 'similitud';
export type OrigenRegistro = 'editor' | 'autonomo';
export type EstadoRegistro = 'pendiente' | 'aprobado' | 'rechazado';

export interface RegistroFila {
  id: number;
  tipo: TipoModelo;
  x: string;
  y: string;
  origen: OrigenRegistro;
  fuente: string;
  url: string;
  confianza: number;
  estado: EstadoRegistro;
  fecha: number;
  hash: string;
}

export interface EntrenamientoFila {
  id: number;
  fecha: number;
  tipo: TipoModelo;
  n_editor: number;
  n_autonomo: number;
  perdida: number;
}

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(RUTA);
  }
  return _db;
}

export function iniciar(): void {
  const c = getDb();
  c.exec(`
    CREATE TABLE IF NOT EXISTS registros(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      x TEXT NOT NULL,
      y TEXT NOT NULL,
      origen TEXT NOT NULL CHECK(origen IN('editor','autonomo')),
      fuente TEXT NOT NULL,
      url TEXT DEFAULT '',
      confianza REAL NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN('pendiente','aprobado','rechazado')),
      fecha REAL NOT NULL,
      hash TEXT UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entrenamientos(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha REAL NOT NULL,
      tipo TEXT NOT NULL,
      n_editor INTEGER NOT NULL,
      n_autonomo INTEGER NOT NULL,
      perdida REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lista_blanca(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dominio TEXT UNIQUE NOT NULL,
      etiqueta TEXT NOT NULL,
      categoria TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      auto_entrenar INTEGER NOT NULL DEFAULT 1,
      creado_en REAL NOT NULL
    );
  `);
}

export function validar(_tipo: TipoModelo, y: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(y)) {
    const [lo, hi] = LIMITES[k] ?? [0, 100];
    if (typeof v !== 'number' || Number.isNaN(v) || v < lo || v > hi) {
      throw new Error(`${k}=${String(v)} fuera de rango [${lo}, ${hi}]`);
    }
  }
}

export function guardar(
  tipo: TipoModelo,
  x: Record<string, unknown>,
  y: Record<string, number>,
  origen: OrigenRegistro,
  fuente: string,
  url = '',
  confianza = 0.5,
  forceAprobado = false
): EstadoRegistro | 'duplicado' {
  iniciar();
  validar(tipo, y);
  const estado: EstadoRegistro =
    forceAprobado || origen === 'editor' || OFICIALES.has(fuente) ? 'aprobado' : 'pendiente';

  const payload = JSON.stringify([tipo, sortKeys(x), sortKeys(y), fuente]);
  const hash = crypto.createHash('sha1').update(payload).digest('hex');

  try {
    const stmt = getDb().prepare(
      `INSERT INTO registros(tipo, x, y, origen, fuente, url, confianza, estado, fecha, hash)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      tipo,
      JSON.stringify(x),
      JSON.stringify(y),
      origen,
      fuente,
      url,
      confianza,
      estado,
      Date.now() / 1000,
      hash
    );
    return estado;
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      return 'duplicado';
    }
    throw err;
  }
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[k] = sortKeys((obj as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  return obj;
}

export function filas(
  tipo?: TipoModelo,
  estado?: EstadoRegistro
): RegistroFila[] {
  iniciar();
  let q = 'SELECT * FROM registros WHERE 1=1';
  const args: string[] = [];
  if (tipo) {
    q += ' AND tipo=?';
    args.push(tipo);
  }
  if (estado) {
    q += ' AND estado=?';
    args.push(estado);
  }
  q += ' ORDER BY id';
  const stmt = getDb().prepare(q);
  return stmt.all(...args) as unknown as RegistroFila[];
}

export function cambiarEstado(id: number, estado: 'aprobado' | 'rechazado'): void {
  iniciar();
  getDb().prepare('UPDATE registros SET estado=? WHERE id=?').run(estado, id);
}

export function logEntrenamiento(
  tipo: TipoModelo,
  nEd: number,
  nAu: number,
  perdida: number
): void {
  iniciar();
  getDb()
    .prepare(
      'INSERT INTO entrenamientos(fecha, tipo, n_editor, n_autonomo, perdida) VALUES(?, ?, ?, ?, ?)'
    )
    .run(Date.now() / 1000, tipo, nEd, nAu, perdida);
}

export function historial(n = 15): EntrenamientoFila[] {
  iniciar();
  return getDb()
    .prepare('SELECT * FROM entrenamientos ORDER BY id DESC LIMIT ?')
    .all(n) as unknown as EntrenamientoFila[];
}

export function resumenConteos(): {
  total: number;
  aprobados: number;
  pendientes: number;
  rechazados: number;
  porTipo: Record<TipoModelo, { editor: number; autonomo: number; pendientes: number }>;
} {
  iniciar();
  const rows = filas();
  let aprobados = 0;
  let pendientes = 0;
  let rechazados = 0;
  const porTipo: Record<
    TipoModelo,
    { editor: number; autonomo: number; pendientes: number }
  > = {
    clima: { editor: 0, autonomo: 0, pendientes: 0 },
    similitud: { editor: 0, autonomo: 0, pendientes: 0 },
  };

  for (const r of rows) {
    if (r.estado === 'aprobado') {
      aprobados++;
      if (r.origen === 'editor') porTipo[r.tipo].editor++;
      else porTipo[r.tipo].autonomo++;
    } else if (r.estado === 'pendiente') {
      pendientes++;
      porTipo[r.tipo].pendientes++;
    } else {
      rechazados++;
    }
  }

  return {
    total: rows.length,
    aprobados,
    pendientes,
    rechazados,
    porTipo,
  };
}
