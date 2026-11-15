import fs from 'node:fs';
import path from 'node:path';
import * as db from './db.ts';
import type { RegistroFila, TipoModelo } from './db.ts';
import {
  ANALOGOS_LUNA_MARTE_PDS,
  ANALOGOS_TERRESTRES_NASA,
  SITIOS_INICIALES,
} from '../src/lib/analogo.ts';

export interface SitioMlConfig {
  periodo: number;
  T: [number, number];
  P: [number, number];
  viento: [number, number];
  luz: [number, number | null];
}

export const SITIOS_ML: Record<string, SitioMlConfig> = {
  ...Object.fromEntries(
    SITIOS_INICIALES.map((s) => [
      s.nombre,
      {
        periodo: s.periodo,
        T: s.T,
        P: s.P,
        viento: s.viento,
        luz: s.luz,
      },
    ])
  ),
  ...Object.fromEntries(
    ANALOGOS_TERRESTRES_NASA.map((t) => [
      t.etiquetaSitio,
      {
        periodo: t.periodo,
        T: t.T,
        P: t.P,
        viento: t.viento,
        luz: t.luz,
      },
    ])
  ),
  ...Object.fromEntries(
    ANALOGOS_LUNA_MARTE_PDS.map((p) => [
      p.etiquetaSitio,
      {
        periodo: p.periodo,
        T: p.T,
        P: p.P,
        viento: p.viento,
        luz: p.luz,
      },
    ])
  ),
};

export const NOMBRES = Object.keys(SITIOS_ML);
export const CLIMA_Y = ['temperatura', 'presion', 'viento', 'luz'] as const;
export const SIM_Y = ['temperatura', 'presion', 'viento', 'luz', 'total'] as const;
export const TOPE_AUTONOMO = 0.4;
const CARPETA = process.env.MODELOS ?? path.resolve(process.cwd(), 'modelos');

// PRNG determinístico (Mulberry32 + Box-Muller) para reproducibilidad por seed
function makeRng(seed: number) {
  let a = (seed + 0x6d2b79f5) >>> 0;
  const rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = (mean = 0, std = 1) => {
    const u1 = Math.max(1e-12, rand());
    const u2 = rand();
    return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  return { rand, normal };
}

function vec(v: number[]): number[] {
  return [
    v[0] / 100,
    Math.log10(Math.max(v[1], 1e-12)) / 5,
    v[2] / 10,
    v[3] / 1000,
  ];
}

export function featsClima(x: { sitio: string; hora: number }): number[] {
  const periodo = SITIOS_ML[x.sitio]?.periodo ?? 24.0;
  const f = (2 * Math.PI * x.hora) / periodo;
  return [...NOMBRES.map((n) => (n === x.sitio ? 1.0 : 0.0)), Math.sin(f), Math.cos(f)];
}

export function featsSim(x: { a: number[]; b: number[] }): number[] {
  const va = vec(x.a);
  const vb = vec(x.b);
  const diff = va.map((val, i) => Math.abs(val - vb[i]));
  return [...va, ...vb, ...diff];
}

export interface SerializedMLP {
  nIn: number;
  nOut: number;
  h: number;
  W1: number[][];
  b1: number[];
  W2: number[][];
  b2: number[];
}

export class MLP {
  nIn: number;
  nOut: number;
  h: number;
  W1: number[][];
  b1: number[];
  W2: number[][];
  b2: number[];

  constructor(nIn: number, nOut: number, h = 24, seed = 0, loaded?: SerializedMLP) {
    if (loaded) {
      this.nIn = loaded.nIn;
      this.nOut = loaded.nOut;
      this.h = loaded.h;
      this.W1 = loaded.W1;
      this.b1 = loaded.b1;
      this.W2 = loaded.W2;
      this.b2 = loaded.b2;
      return;
    }
    this.nIn = nIn;
    this.nOut = nOut;
    this.h = h;
    const rng = makeRng(seed + 17);
    this.W1 = Array.from({ length: nIn }, () =>
      Array.from({ length: h }, () => rng.normal(0, 0.5))
    );
    this.b1 = new Array<number>(h).fill(0);
    this.W2 = Array.from({ length: h }, () =>
      Array.from({ length: nOut }, () => rng.normal(0, 0.5))
    );
    this.b2 = new Array<number>(nOut).fill(0);
  }

  forward(x: number[]): number[] {
    const hidden = new Array<number>(this.h);
    for (let j = 0; j < this.h; j++) {
      let s = this.b1[j];
      for (let i = 0; i < this.nIn; i++) {
        s += x[i] * this.W1[i][j];
      }
      hidden[j] = Math.tanh(s);
    }
    const out = new Array<number>(this.nOut);
    for (let k = 0; k < this.nOut; k++) {
      let s = this.b2[k];
      for (let j = 0; j < this.h; j++) {
        s += hidden[j] * this.W2[j][k];
      }
      out[k] = s;
    }
    return out;
  }

  fit(
    X: number[][],
    Y: number[][],
    rawWeights: number[],
    ep = 1500,
    lr = 0.02
  ): number {
    const N = X.length;
    const wSum = rawWeights.reduce((a, b) => a + b, 0) || 1;
    const w = rawWeights.map((v) => v / wSum);

    // Estados de Adam para W1, b1, W2, b2
    const mW1 = Array.from({ length: this.nIn }, () => new Array<number>(this.h).fill(0));
    const vW1 = Array.from({ length: this.nIn }, () => new Array<number>(this.h).fill(0));
    const mb1 = new Array<number>(this.h).fill(0);
    const vb1 = new Array<number>(this.h).fill(0);
    const mW2 = Array.from({ length: this.h }, () => new Array<number>(this.nOut).fill(0));
    const vW2 = Array.from({ length: this.h }, () => new Array<number>(this.nOut).fill(0));
    const mb2 = new Array<number>(this.nOut).fill(0);
    const vb2 = new Array<number>(this.nOut).fill(0);

    const gW1 = Array.from({ length: this.nIn }, () => new Array<number>(this.h).fill(0));
    const gb1 = new Array<number>(this.h).fill(0);
    const gW2 = Array.from({ length: this.h }, () => new Array<number>(this.nOut).fill(0));
    const gb2 = new Array<number>(this.nOut).fill(0);

    const H = Array.from({ length: N }, () => new Array<number>(this.h));
    const dOut = new Array<number>(this.nOut);
    const dH = new Array<number>(this.h);

    let lastLoss = 0;

    for (let t = 1; t <= ep; t++) {
      // Cero gradientes
      for (let i = 0; i < this.nIn; i++) gW1[i].fill(0);
      gb1.fill(0);
      for (let j = 0; j < this.h; j++) gW2[j].fill(0);
      gb2.fill(0);

      let loss = 0;

      for (let n = 0; n < N; n++) {
        const xn = X[n];
        const yn = Y[n];
        const wn = w[n];
        const hn = H[n];

        // Forward oculta
        for (let j = 0; j < this.h; j++) {
          let s = this.b1[j];
          for (let i = 0; i < this.nIn; i++) {
            s += xn[i] * this.W1[i][j];
          }
          hn[j] = Math.tanh(s);
        }

        // Forward salida y error
        for (let k = 0; k < this.nOut; k++) {
          let o = this.b2[k];
          for (let j = 0; j < this.h; j++) {
            o += hn[j] * this.W2[j][k];
          }
          const err = o - yn[k];
          loss += wn * err * err;
          dOut[k] = 2 * wn * err;
          gb2[k] += dOut[k];
        }

        // Backward W2 y capa oculta
        for (let j = 0; j < this.h; j++) {
          let gradH = 0;
          for (let k = 0; k < this.nOut; k++) {
            gW2[j][k] += hn[j] * dOut[k];
            gradH += dOut[k] * this.W2[j][k];
          }
          dH[j] = gradH * (1 - hn[j] * hn[j]);
          gb1[j] += dH[j];
        }

        // Backward W1
        for (let i = 0; i < this.nIn; i++) {
          const xi = xn[i];
          for (let j = 0; j < this.h; j++) {
            gW1[i][j] += xi * dH[j];
          }
        }
      }

      lastLoss = loss;

      const b1Corr = 1 - Math.pow(0.9, t);
      const b2Corr = 1 - Math.pow(0.999, t);

      // Paso Adam
      for (let i = 0; i < this.nIn; i++) {
        for (let j = 0; j < this.h; j++) {
          const g = gW1[i][j];
          mW1[i][j] = 0.9 * mW1[i][j] + 0.1 * g;
          vW1[i][j] = 0.999 * vW1[i][j] + 0.001 * g * g;
          this.W1[i][j] -=
            (lr * (mW1[i][j] / b1Corr)) / (Math.sqrt(vW1[i][j] / b2Corr) + 1e-8);
        }
      }
      for (let j = 0; j < this.h; j++) {
        const g = gb1[j];
        mb1[j] = 0.9 * mb1[j] + 0.1 * g;
        vb1[j] = 0.999 * vb1[j] + 0.001 * g * g;
        this.b1[j] -= (lr * (mb1[j] / b1Corr)) / (Math.sqrt(vb1[j] / b2Corr) + 1e-8);

        for (let k = 0; k < this.nOut; k++) {
          const gw = gW2[j][k];
          mW2[j][k] = 0.9 * mW2[j][k] + 0.1 * gw;
          vW2[j][k] = 0.999 * vW2[j][k] + 0.001 * gw * gw;
          this.W2[j][k] -=
            (lr * (mW2[j][k] / b1Corr)) / (Math.sqrt(vW2[j][k] / b2Corr) + 1e-8);
        }
      }
      for (let k = 0; k < this.nOut; k++) {
        const g = gb2[k];
        mb2[k] = 0.9 * mb2[k] + 0.1 * g;
        vb2[k] = 0.999 * vb2[k] + 0.001 * g * g;
        this.b2[k] -= (lr * (mb2[k] / b1Corr)) / (Math.sqrt(vb2[k] / b2Corr) + 1e-8);
      }
    }

    return lastLoss;
  }

  serialize(): SerializedMLP {
    return {
      nIn: this.nIn,
      nOut: this.nOut,
      h: this.h,
      W1: this.W1,
      b1: this.b1,
      W2: this.W2,
      b2: this.b2,
    };
  }
}

export interface SerializedEnsamble {
  tipo: TipoModelo;
  mu: number[];
  sd: number[];
  ms: SerializedMLP[];
  perdidaMedia: number;
  nEditor: number;
  nAutonomo: number;
  entrenadoEn: number;
  epocas?: number;
  duracionMs?: number;
}

export class Ensamble {
  tipo: TipoModelo;
  ms: MLP[] = [];
  mu: number[] = [];
  sd: number[] = [];
  perdidaMedia = 0;
  nEditor = 0;
  nAutonomo = 0;
  entrenadoEn = 0;
  epocas = 1200;
  duracionMs = 0;

  constructor(tipo: TipoModelo, loaded?: SerializedEnsamble) {
    this.tipo = tipo;
    if (loaded) {
      this.mu = loaded.mu;
      this.sd = loaded.sd;
      this.ms = loaded.ms.map((m) => new MLP(m.nIn, m.nOut, m.h, 0, m));
      this.perdidaMedia = loaded.perdidaMedia;
      this.nEditor = loaded.nEditor;
      this.nAutonomo = loaded.nAutonomo;
      this.entrenadoEn = loaded.entrenadoEn;
      this.epocas = loaded.epocas ?? 1500;
      this.duracionMs = loaded.duracionMs ?? 0;
    }
  }

  private encodeY(y: Record<string, number>): number[] {
    if (this.tipo === 'clima') {
      return [
        y.temperatura,
        Math.log10(Math.max(y.presion, 1e-12)),
        y.viento,
        y.luz,
      ];
    }
    return SIM_Y.map((k) => y[k]);
  }

  private decodeY(r: number[]): number[] {
    const out = [...r];
    if (this.tipo === 'clima') {
      out[0] = Math.max(0.1, out[0]);
      out[1] = Math.pow(10, out[1]);
      out[2] = Math.max(0, out[2]);
      out[3] = Math.max(0, out[3]);
    }
    return out;
  }

  entrenar(
    filas: RegistroFila[],
    nMiembros = 3,
    epocas = 1200,
    ocultas = 24
  ): { perdida: number; nEditor: number; nAutonomo: number; duracionMs: number; epocas: number } {
    const tInicio = Date.now();
    const X = filas.map((r) => {
      const parsed = JSON.parse(r.x);
      return this.tipo === 'clima' ? featsClima(parsed) : featsSim(parsed);
    });
    const Y = filas.map((r) => this.encodeY(JSON.parse(r.y)));

    const esEditor = filas.map((r) => r.origen === 'editor');
    const w = filas.map((r, idx) =>
      esEditor[idx] ? 1.0 : 0.5 * Number(r.confianza || 0.5)
    );

    const nEd = esEditor.filter(Boolean).length;
    const nAu = esEditor.length - nEd;

    if (nEd > 0 && nAu > 0) {
      let sumEd = 0;
      let sumAu = 0;
      for (let i = 0; i < w.length; i++) {
        if (esEditor[i]) sumEd += w[i];
        else sumAu += w[i];
      }
      if (sumAu > 0) {
        const factor = Math.min(
          1.0,
          (TOPE_AUTONOMO / (1 - TOPE_AUTONOMO)) * (sumEd / sumAu)
        );
        for (let i = 0; i < w.length; i++) {
          if (!esEditor[i]) w[i] *= factor;
        }
      }
    }

    const nOut = Y[0].length;
    const N = Y.length;
    const mu = new Array<number>(nOut).fill(0);
    for (let n = 0; n < N; n++) {
      for (let k = 0; k < nOut; k++) mu[k] += Y[n][k];
    }
    for (let k = 0; k < nOut; k++) mu[k] /= N;

    const sd = new Array<number>(nOut).fill(0);
    for (let n = 0; n < N; n++) {
      for (let k = 0; k < nOut; k++) {
        const d = Y[n][k] - mu[k];
        sd[k] += d * d;
      }
    }
    for (let k = 0; k < nOut; k++) sd[k] = Math.sqrt(sd[k] / N) + 1e-6;

    const Ynorm = Y.map((row) => row.map((val, k) => (val - mu[k]) / sd[k]));

    this.mu = mu;
    this.sd = sd;
    this.ms = Array.from({ length: nMiembros }, (_, k) => new MLP(X[0].length, nOut, ocultas, k));

    const perdidas = this.ms.map((m) => m.fit(X, Ynorm, w, epocas));
    this.perdidaMedia = perdidas.reduce((a, b) => a + b, 0) / perdidas.length;
    this.nEditor = nEd;
    this.nAutonomo = nAu;
    this.entrenadoEn = Date.now() / 1000;
    this.epocas = epocas;
    this.duracionMs = Date.now() - tInicio;

    return {
      perdida: this.perdidaMedia,
      nEditor: nEd,
      nAutonomo: nAu,
      duracionMs: this.duracionMs,
      epocas: this.epocas,
    };
  }

  predecir(x: { sitio: string; hora: number } | { a: number[]; b: number[] }): Record<
    string,
    { valor: number; incertidumbre: number }
  > {
    const f =
      this.tipo === 'clima'
        ? featsClima(x as { sitio: string; hora: number })
        : featsSim(x as { a: number[]; b: number[] });

    const preds = this.ms.map((m) => {
      const z = m.forward(f);
      const unnorm = z.map((val, i) => val * this.sd[i] + this.mu[i]);
      const inv = this.decodeY(unnorm);
      if (this.tipo !== 'clima') {
        return inv.map((v) => Math.max(0, Math.min(100, v)));
      }
      return inv;
    });

    const keys = this.tipo === 'clima' ? [...CLIMA_Y] : [...SIM_Y];
    const out: Record<string, { valor: number; incertidumbre: number }> = {};

    keys.forEach((k, i) => {
      const vals = preds.map((p) => p[i]);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance =
        vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length;
      out[k] = {
        valor: mean,
        incertidumbre: Math.sqrt(variance),
      };
    });

    return out;
  }

  serialize(): SerializedEnsamble {
    return {
      tipo: this.tipo,
      mu: this.mu,
      sd: this.sd,
      ms: this.ms.map((m) => m.serialize()),
      perdidaMedia: this.perdidaMedia,
      nEditor: this.nEditor,
      nAutonomo: this.nAutonomo,
      entrenadoEn: this.entrenadoEn,
      epocas: this.epocas,
      duracionMs: this.duracionMs,
    };
  }
}

export function guardarModelo(e: Ensamble): void {
  fs.mkdirSync(CARPETA, { recursive: true });
  fs.writeFileSync(
    path.join(CARPETA, `${e.tipo}.json`),
    JSON.stringify(e.serialize()),
    'utf-8'
  );
}

export function cargarModelo(tipo: TipoModelo): Ensamble | null {
  const p = path.join(CARPETA, `${tipo}.json`);
  if (!fs.existsSync(p)) return null;
  const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as SerializedEnsamble;
  const esperadoIn = tipo === 'clima' ? NOMBRES.length + 2 : 12;
  if (!raw.ms?.length || raw.ms[0].nIn !== esperadoIn) {
    return null;
  }
  return new Ensamble(tipo, raw);
}

export function entrenarTodo(opciones?: {
  epocas?: number;
  miembros?: number;
  ocultas?: number;
}): {
  clima: number | string;
  similitud: number | string;
  duracionMs: number;
  epocas: number;
  miembros: number;
  ocultas: number;
} {
  const epocas = Math.max(200, Math.min(4000, Math.round(opciones?.epocas ?? 1200)));
  const miembros = Math.max(1, Math.min(5, Math.round(opciones?.miembros ?? 3)));
  const ocultas = Math.max(8, Math.min(64, Math.round(opciones?.ocultas ?? 24)));

  const t0 = Date.now();
  const out: {
    clima: number | string;
    similitud: number | string;
    duracionMs: number;
    epocas: number;
    miembros: number;
    ocultas: number;
  } = {
    clima: 'pocos datos',
    similitud: 'pocos datos',
    duracionMs: 0,
    epocas,
    miembros,
    ocultas,
  };

  for (const tipo of ['clima', 'similitud'] as const) {
    const fsRows = db.filas(tipo, 'aprobado');
    if (fsRows.length < 10) {
      out[tipo] = 'pocos datos';
      continue;
    }
    const e = new Ensamble(tipo);
    const { perdida, nEditor, nAutonomo } = e.entrenar(fsRows, miembros, epocas, ocultas);
    guardarModelo(e);
    db.logEntrenamiento(tipo, nEditor, nAutonomo, perdida);
    out[tipo] = Number(perdida.toFixed(4));
  }

  out.duracionMs = Date.now() - t0;
  return out;
}
