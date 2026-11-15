import {
  METADATOS_VARIABLES,
  ORDEN_VARIABLES,
  ResultadoComparacion,
  SitioAmbiental,
  VariableAnalogo,
} from './analogo';

export type CanvasViewportMode = 'split' | 'siteA' | 'siteB' | 'instruments';
export type OscilloscopeChannel = 'temperatura' | 'luz' | 'viento' | 'presion';

export interface CanvasLayerFlags {
  atmosphere: boolean;
  wind: boolean;
  radiation: boolean;
  terrain: boolean;
  physics: boolean;
  instruments: boolean;
  grid: boolean;
}

export interface CanvasCamera {
  zoom: number;
  panX: number;
  panY: number;
}

export interface CanvasPointerState {
  x: number;
  y: number;
  inside: boolean;
}

export interface CanvasEngineSceneState {
  sitioA: SitioAmbiental;
  sitioB: SitioAmbiental;
  resultado: ResultadoComparacion;
  criticas: VariableAnalogo[];
  pesos: Record<VariableAnalogo, number>;
  viewportMode: CanvasViewportMode;
  oscChannel: OscilloscopeChannel;
  layers: CanvasLayerFlags;
  camera: CanvasCamera;
  pointer: CanvasPointerState;
  playing: boolean;
  speed: number;
  sampleCursor: number; // índice continuo [0, n-1] dentro de seriesA/seriesB
}

export interface CanvasHoverSummary {
  zone: 'sceneA' | 'sceneB' | 'radar' | 'oscilloscope' | 'composition' | 'none';
  title: string;
  lines: string[];
}

interface StarParticle {
  xFrac: number;
  yFrac: number;
  size: number;
  phase: number;
}

interface WindParticle {
  side: 'A' | 'B';
  xFrac: number;
  yFrac: number;
  speedMul: number;
  len: number;
  alpha: number;
}

interface RadStreak {
  side: 'A' | 'B';
  xFrac: number;
  yFrac: number;
  vy: number;
  vx: number;
  life: number;
  maxLife: number;
}

interface DropProbe {
  id: number;
  side: 'A' | 'B';
  xNorm: number; // [0.06, 0.94] dentro de la escena del sitio
  yMeters: number; // altura sobre el suelo base (positivo hacia arriba)
  vyMeters: number; // m/s (negativo cae)
  vxNorm: number;
  bounces: number;
  settled: boolean;
  trail: Array<{ xNorm: number; yMeters: number }>;
  age: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FONT_MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace';
const FONT_SANS = '"IBM Plex Sans", system-ui, -apple-system, sans-serif';

const COLOR_BG = '#07090E';
const COLOR_PANEL = '#0D121D';
const COLOR_BORDER = '#1E293B';
const COLOR_TEXT = '#E2E8F0';
const COLOR_MUTED = '#94A3B8';
const COLOR_CYAN = '#06B6D4';
const COLOR_AMBER = '#F59E0B';
const COLOR_ROSE = '#F43F5E';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  const k = clamp(t, 0, 1);
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

function rgbCss(c: [number, number, number], alpha = 1): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

/**
 * Calcula los colores del suelo/regolito a partir de los óxidos reales de `sitio.suelo`.
 */
function computeSoilPalette(sitio: SitioAmbiental): {
  surface: [number, number, number];
  subsoil: [number, number, number];
  ridge: [number, number, number];
} {
  const fe = sitio.suelo.Fe2O3 ?? 0.08;
  const ti = sitio.suelo.TiO2 ?? 0;
  const sio2 = sitio.suelo.SiO2 ?? 0.45;
  const al = sitio.suelo.Al2O3 ?? 0.14;

  // Base neutra basáltico-silicatada + óxido de hierro (Marte/Atacama) + titanio oscuro (Luna mare)
  let base: [number, number, number] = [108, 108, 114];
  if (sio2 > 0.55) {
    base = mixRgb(base, [176, 152, 120], 0.45);
  }
  if (fe > 0.12) {
    base = mixRgb(base, [186, 86, 48], clamp((fe - 0.1) * 4.5, 0, 0.85));
  }
  if (ti > 0.01 || (sitio.P[0] < 10 && al > 0.15)) {
    const lunarShift = clamp(ti * 6 + (al > 0.2 ? 0.25 : 0), 0, 0.75);
    base = mixRgb(base, [96, 100, 110], lunarShift);
    if (al > 0.22) {
      base = mixRgb(base, [146, 150, 158], 0.55); // tierras altas anortosíticas
    }
  }
  return {
    surface: base,
    subsoil: mixRgb(base, [14, 18, 28], 0.62),
    ridge: mixRgb(base, [18, 22, 34], 0.42),
  };
}

/**
 * Calcula los colores de atmósfera y cielo según la presión barométrica P[0] y la elevación solar.
 */
function computeSkyColors(
  sitio: SitioAmbiental,
  solarNorm: number
): {
  zenith: [number, number, number];
  horizon: [number, number, number];
  starAlpha: number;
} {
  const p = Math.max(0, sitio.P[0]);
  const dayFactor = clamp(solarNorm, 0, 1);

  if (p < 50) {
    // Vacío lunar o exosfera tenue: cielo negro estrellado
    return {
      zenith: [4, 6, 12],
      horizon: mixRgb([8, 11, 20], [28, 32, 46], dayFactor * 0.35),
      starAlpha: 0.92,
    };
  }

  if (p < 4000) {
    // Atmósfera marciana tenue de CO2 + polvo fino
    const zenithDay: [number, number, number] = [56, 38, 34];
    const zenithNight: [number, number, number] = [8, 10, 18];
    const horizonDay: [number, number, number] = [168, 104, 66];
    const horizonNight: [number, number, number] = [24, 18, 22];
    return {
      zenith: mixRgb(zenithNight, zenithDay, dayFactor),
      horizon: mixRgb(horizonNight, horizonDay, dayFactor),
      starAlpha: clamp(1 - dayFactor * 0.9, 0.12, 0.85),
    };
  }

  // Atmósfera terrestre densa (dispersión de Rayleigh)
  const zenithDay: [number, number, number] = [20, 62, 124];
  const zenithNight: [number, number, number] = [7, 11, 24];
  const horizonDay: [number, number, number] = [104, 162, 214];
  const horizonNight: [number, number, number] = [18, 28, 48];
  return {
    zenith: mixRgb(zenithNight, zenithDay, dayFactor),
    horizon: mixRgb(horizonNight, horizonDay, dayFactor),
    starAlpha: clamp((1 - dayFactor * 1.4) * 0.78, 0, 0.78),
  };
}

/**
 * Muestrea altura normalizada del terreno procedural [0..1] desde la base inferior de una escena.
 * Pendiente define inclinación global y rugosidad define relieve de alta frecuencia.
 */
function sampleTerrainElevationFrac(
  sitio: SitioAmbiental,
  xNorm: number
): number {
  const slopeRad = (clamp(sitio.pendiente, 0, 45) * Math.PI) / 180;
  const slopeRise = Math.tan(slopeRad) * (xNorm - 0.5) * 0.36;
  const rough = clamp(sitio.rugosidad, 0.005, 0.35);
  const amp = 0.025 + rough * 0.42;
  const phase = (sitio.id.length * 1.7 + (sitio.lat ?? 12) * 0.31) % 6.28;
  const macro = Math.sin(xNorm * 6.8 + phase) * amp * 0.55;
  const mid = Math.sin(xNorm * 19.3 + phase * 1.7) * amp * 0.28;
  const micro = Math.cos(xNorm * 47.0 + phase * 2.3) * amp * 0.14;
  return clamp(0.24 + slopeRise + macro + mid + micro, 0.08, 0.62);
}

export class PlanetaryCanvasEngine {
  private stars: StarParticle[] = [];
  private windParticles: WindParticle[] = [];
  private radStreaks: RadStreak[] = [];
  private probes: DropProbe[] = [];
  private nextProbeId = 1;
  private simTimeSec = 0;

  constructor() {
    this.initPools();
  }

  private initPools() {
    this.stars = Array.from({ length: 140 }, (_, i) => {
      const s1 = Math.sin(i * 12.9898) * 43758.5453;
      const s2 = Math.sin(i * 78.233 + 1.1) * 24634.6345;
      return {
        xFrac: s1 - Math.floor(s1),
        yFrac: (s2 - Math.floor(s2)) * 0.72,
        size: 0.7 + ((i * 7) % 10) * 0.11,
        phase: i * 0.7,
      };
    });

    this.windParticles = Array.from({ length: 90 }, (_, i) => ({
      side: i % 2 === 0 ? 'A' : 'B',
      xFrac: ((i * 37) % 100) / 100,
      yFrac: 0.14 + (((i * 53) % 100) / 100) * 0.68,
      speedMul: 0.7 + ((i * 19) % 10) * 0.07,
      len: 14 + ((i * 13) % 22),
      alpha: 0.2 + ((i * 29) % 10) * 0.055,
    }));

    this.radStreaks = [];
    this.probes = [];
  }

  public clearProbes() {
    this.probes = [];
  }

  public spawnDropProbe(side: 'A' | 'B', xNorm = 0.5) {
    this.probes = [
      ...this.probes.slice(-11),
      {
        id: this.nextProbeId++,
        side,
        xNorm: clamp(xNorm, 0.08, 0.92),
        yMeters: 28,
        vyMeters: 0,
        vxNorm: 0,
        bounces: 0,
        settled: false,
        trail: [],
        age: 0,
      },
    ];
  }

  public step(
    dtSec: number,
    state: CanvasEngineSceneState,
    advanceCursor: (deltaIdx: number) => void
  ) {
    const dt = clamp(dtSec, 0, 0.05);
    this.simTimeSec += dt;

    const n = Math.max(2, state.resultado.seriesA.t.length);
    if (state.playing) {
      // Avance fluido del cursor sobre las n muestras del experimento
      const rate = (n / 14) * state.speed;
      advanceCursor(dt * rate);
    }

    const idx = clamp(Math.floor(state.sampleCursor), 0, n - 1);
    const windA = state.resultado.seriesA.viento[idx] ?? state.sitioA.viento[0];
    const windB = state.resultado.seriesB.viento[idx] ?? state.sitioB.viento[0];

    // Advección de líneas de viento según velocidad real y densidad atmosférica
    if (state.layers.wind) {
      for (const wp of this.windParticles) {
        const sitio = wp.side === 'A' ? state.sitioA : state.sitioB;
        const pFactor = sitio.P[0] < 20 ? 0 : clamp(Math.log10(sitio.P[0] + 1) / 5, 0.2, 1);
        const vel = (wp.side === 'A' ? windA : windB) * pFactor;
        wp.xFrac += dt * (0.04 + vel * 0.035) * wp.speedMul * state.speed;
        if (wp.xFrac > 1.08) {
          wp.xFrac = -0.08;
        }
      }
    }

    // Rayos de radiación cósmica proporcionales a sitio.radiacion (µSv/h)
    if (state.layers.radiation) {
      const rateA = clamp(state.sitioA.radiacion / 18, 0.04, 2.8);
      const rateB = clamp(state.sitioB.radiacion / 18, 0.04, 2.8);
      if (Math.random() < dt * rateA * 6 * state.speed) {
        this.radStreaks.push({
          side: 'A',
          xFrac: Math.random(),
          yFrac: 0.02,
          vx: (Math.random() - 0.5) * 0.16,
          vy: 0.65 + Math.random() * 0.45,
          life: 0,
          maxLife: 0.55 + Math.random() * 0.3,
        });
      }
      if (Math.random() < dt * rateB * 6 * state.speed) {
        this.radStreaks.push({
          side: 'B',
          xFrac: Math.random(),
          yFrac: 0.02,
          vx: (Math.random() - 0.5) * 0.16,
          vy: 0.65 + Math.random() * 0.45,
          life: 0,
          maxLife: 0.55 + Math.random() * 0.3,
        });
      }
      this.radStreaks = this.radStreaks
        .map((r) => ({
          ...r,
          xFrac: r.xFrac + r.vx * dt,
          yFrac: r.yFrac + r.vy * dt,
          life: r.life + dt,
        }))
        .filter((r) => r.life < r.maxLife && r.yFrac < 0.92);
    } else if (this.radStreaks.length > 0) {
      this.radStreaks = [];
    }

    // Física balística de sondas gravitacionales (y en metros respecto al terreno local)
    if (state.layers.physics && this.probes.length > 0) {
      const nextProbes: DropProbe[] = [];
      for (const probe of this.probes) {
        const sitio = probe.side === 'A' ? state.sitioA : state.sitioB;
        const g = Math.max(0.2, sitio.g);
        const slopeRad = (sitio.pendiente * Math.PI) / 180;
        const groundY = sampleTerrainElevationFrac(sitio, probe.xNorm) * 40; // ~4-24 m escala escena
        const p = { ...probe, age: probe.age + dt };

        if (!p.settled) {
          p.vyMeters -= g * dt * 1.4;
          p.yMeters += p.vyMeters * dt * 1.4;
          p.xNorm = clamp(p.xNorm + p.vxNorm * dt, 0.05, 0.95);

          if (p.yMeters <= groundY) {
            p.yMeters = groundY;
            if (Math.abs(p.vyMeters) > 1.2 && p.bounces < 4) {
              p.vyMeters = -p.vyMeters * 0.48;
              p.vxNorm += Math.sin(slopeRad) * 0.08;
              p.bounces += 1;
            } else {
              p.vyMeters = 0;
              p.vxNorm = 0;
              p.settled = true;
            }
          }
          p.trail = [...p.trail.slice(-28), { xNorm: p.xNorm, yMeters: p.yMeters }];
        }

        if (p.age < 14) {
          nextProbes.push(p);
        }
      }
      this.probes = nextProbes;
    }
  }

  private computeLayout(
    width: number,
    height: number,
    state: CanvasEngineSceneState
  ): {
    sceneA: Rect | null;
    sceneB: Rect | null;
    radar: Rect | null;
    osc: Rect | null;
    comp: Rect | null;
  } {
    const pad = 10;
    const gap = 10;
    const innerW = Math.max(200, width - pad * 2);
    const innerH = Math.max(200, height - pad * 2);

    if (state.viewportMode === 'instruments') {
      const topH = Math.round(innerH * 0.54);
      const botH = innerH - topH - gap;
      const radarW = Math.round(innerW * 0.42);
      const compW = innerW - radarW - gap;
      return {
        sceneA: null,
        sceneB: null,
        radar: { x: pad, y: pad, w: radarW, h: topH },
        comp: { x: pad + radarW + gap, y: pad, w: compW, h: topH },
        osc: { x: pad, y: pad + topH + gap, w: innerW, h: botH },
      };
    }

    const showInst = state.layers.instruments && innerH > 440;
    const topH = showInst ? Math.round(innerH * 0.56) : innerH;
    const botH = showInst ? innerH - topH - gap : 0;

    let sceneA: Rect | null = null;
    let sceneB: Rect | null = null;

    if (state.viewportMode === 'split') {
      const halfW = Math.floor((innerW - gap) / 2);
      sceneA = { x: pad, y: pad, w: halfW, h: topH };
      sceneB = { x: pad + halfW + gap, y: pad, w: innerW - halfW - gap, h: topH };
    } else if (state.viewportMode === 'siteA') {
      sceneA = { x: pad, y: pad, w: innerW, h: topH };
    } else {
      sceneB = { x: pad, y: pad, w: innerW, h: topH };
    }

    if (!showInst) {
      return { sceneA, sceneB, radar: null, osc: null, comp: null };
    }

    const botY = pad + topH + gap;
    const radarW = Math.round(innerW * 0.29);
    const compW = Math.round(innerW * 0.27);
    const oscW = innerW - radarW - compW - gap * 2;

    return {
      sceneA,
      sceneB,
      radar: { x: pad, y: botY, w: radarW, h: botH },
      osc: { x: pad + radarW + gap, y: botY, w: oscW, h: botH },
      comp: { x: pad + radarW + gap + oscW + gap, y: botY, w: compW, h: botH },
    };
  }

  public getHoverInfo(
    width: number,
    height: number,
    state: CanvasEngineSceneState
  ): CanvasHoverSummary {
    const { x, y, inside } = state.pointer;
    if (!inside) {
      return { zone: 'none', title: 'Listo', lines: [] };
    }
    const layout = this.computeLayout(width, height, state);

    const hitRect = (r: Rect | null) =>
      r !== null && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

    if (hitRect(layout.sceneA) && layout.sceneA) {
      const r = layout.sceneA;
      const xNorm = clamp((x - r.x) / r.w, 0, 1);
      const elevM = (sampleTerrainElevationFrac(state.sitioA, xNorm) * 40).toFixed(1);
      const idx = clamp(
        Math.floor(state.sampleCursor),
        0,
        state.resultado.seriesA.t.length - 1
      );
      return {
        zone: 'sceneA',
        title: `Sitio A · ${state.sitioA.nombre}`,
        lines: [
          `t = ${(state.resultado.seriesA.t[idx] ?? 0).toFixed(1)} h`,
          `T = ${(state.resultado.seriesA.temperatura[idx] ?? state.sitioA.T[0]).toFixed(1)} K`,
          `P = ${(state.resultado.seriesA.presion[idx] ?? state.sitioA.P[0]).toFixed(0)} Pa`,
          `g = ${state.sitioA.g.toFixed(2)} m/s² · Cota rel = ${elevM} m`,
        ],
      };
    }

    if (hitRect(layout.sceneB) && layout.sceneB) {
      const r = layout.sceneB;
      const xNorm = clamp((x - r.x) / r.w, 0, 1);
      const elevM = (sampleTerrainElevationFrac(state.sitioB, xNorm) * 40).toFixed(1);
      const idx = clamp(
        Math.floor(state.sampleCursor),
        0,
        state.resultado.seriesB.t.length - 1
      );
      return {
        zone: 'sceneB',
        title: `Sitio B · ${state.sitioB.nombre}`,
        lines: [
          `t = ${(state.resultado.seriesB.t[idx] ?? 0).toFixed(1)} h`,
          `T = ${(state.resultado.seriesB.temperatura[idx] ?? state.sitioB.T[0]).toFixed(1)} K`,
          `P = ${(state.resultado.seriesB.presion[idx] ?? state.sitioB.P[0]).toFixed(0)} Pa`,
          `g = ${state.sitioB.g.toFixed(2)} m/s² · Cota rel = ${elevM} m`,
        ],
      };
    }

    if (hitRect(layout.osc) && layout.osc) {
      const r = layout.osc;
      const plotX = r.x + 48;
      const plotW = Math.max(40, r.w - 64);
      const frac = clamp((x - plotX) / plotW, 0, 1);
      const n = state.resultado.seriesA.t.length;
      const sampleIdx = clamp(Math.round(frac * (n - 1)), 0, n - 1);
      const ch = state.oscChannel;
      const valA = state.resultado.seriesA[ch][sampleIdx] ?? 0;
      const valB = state.resultado.seriesB[ch][sampleIdx] ?? 0;
      const tH = state.resultado.seriesA.t[sampleIdx] ?? 0;
      return {
        zone: 'oscilloscope',
        title: `Osciloscopio · ${ch.toUpperCase()}`,
        lines: [
          `Muestra #${sampleIdx + 1} · t = ${tH.toFixed(1)} h`,
          `Sitio A: ${valA.toFixed(2)}`,
          `Sitio B: ${valB.toFixed(2)}`,
        ],
      };
    }

    if (hitRect(layout.radar) && layout.radar) {
      return {
        zone: 'radar',
        title: 'Radar 9D de Analogía',
        lines: [
          `Similitud total: ${state.resultado.total.toFixed(1)}%`,
          `Media ponderada: ${state.resultado.mediaSimple.toFixed(1)}%`,
          `Peor crítica: ${METADATOS_VARIABLES[state.resultado.peorCritica.variable].etiqueta}`,
        ],
      };
    }

    if (hitRect(layout.comp) && layout.comp) {
      return {
        zone: 'composition',
        title: 'Espectro Químico TVD',
        lines: [
          `Similitud Aire: ${state.resultado.porVariable.aire.toFixed(1)}%`,
          `Similitud Suelo: ${state.resultado.porVariable.suelo.toFixed(1)}%`,
        ],
      };
    }

    return { zone: 'none', title: 'Visor Canvas', lines: [] };
  }

  public hitTestSceneSide(
    clientX: number,
    clientY: number,
    width: number,
    height: number,
    state: CanvasEngineSceneState
  ): { side: 'A' | 'B'; xNorm: number } | null {
    const layout = this.computeLayout(width, height, state);
    if (
      layout.sceneA &&
      clientX >= layout.sceneA.x &&
      clientX <= layout.sceneA.x + layout.sceneA.w &&
      clientY >= layout.sceneA.y &&
      clientY <= layout.sceneA.y + layout.sceneA.h
    ) {
      return {
        side: 'A',
        xNorm: clamp((clientX - layout.sceneA.x) / layout.sceneA.w, 0.08, 0.92),
      };
    }
    if (
      layout.sceneB &&
      clientX >= layout.sceneB.x &&
      clientX <= layout.sceneB.x + layout.sceneB.w &&
      clientY >= layout.sceneB.y &&
      clientY <= layout.sceneB.y + layout.sceneB.h
    ) {
      return {
        side: 'B',
        xNorm: clamp((clientX - layout.sceneB.x) / layout.sceneB.w, 0.08, 0.92),
      };
    }
    return null;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dpr: number,
    state: CanvasEngineSceneState
  ) {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Fondo principal obsidiana espacial
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, width, height);

    const layout = this.computeLayout(width, height, state);

    if (layout.sceneA) {
      this.renderBiomeViewport(ctx, layout.sceneA, 'A', state.sitioA, state);
    }
    if (layout.sceneB) {
      this.renderBiomeViewport(ctx, layout.sceneB, 'B', state.sitioB, state);
    }
    if (layout.radar) {
      this.renderRadarScope(ctx, layout.radar, state);
    }
    if (layout.osc) {
      this.renderOscilloscope(ctx, layout.osc, state);
    }
    if (layout.comp) {
      this.renderCompositionMatrix(ctx, layout.comp, state);
    }

    // Retícula técnica global y sonda de cursor
    if (state.layers.grid && state.pointer.inside) {
      this.renderPointerCrosshair(ctx, width, height, state);
    }

    ctx.restore();
  }

  private renderBiomeViewport(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    side: 'A' | 'B',
    sitio: SitioAmbiental,
    state: CanvasEngineSceneState
  ) {
    const accent = side === 'A' ? COLOR_CYAN : COLOR_AMBER;
    const series = side === 'A' ? state.resultado.seriesA : state.resultado.seriesB;
    const n = Math.max(1, series.t.length);
    const idx = clamp(Math.floor(state.sampleCursor), 0, n - 1);

    const tempK = series.temperatura[idx] ?? sitio.T[0];
    const presPa = series.presion[idx] ?? sitio.P[0];
    const windMs = series.viento[idx] ?? sitio.viento[0];
    const solarWm2 = series.luz[idx] ?? sitio.luz[0];
    const peakSolar = Math.max(100, sitio.luz[0]);
    const solarNorm = clamp(solarWm2 / peakSolar, 0, 1);

    ctx.save();
    // Marco contenedor con clip estricto
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    ctx.fillStyle = COLOR_PANEL;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    // Transformación de cámara dentro del viewport físico
    ctx.save();
    const cx = rect.x + rect.w * 0.5 + state.camera.panX;
    const cy = rect.y + rect.h * 0.5 + state.camera.panY;
    ctx.translate(cx, cy);
    ctx.scale(state.camera.zoom, state.camera.zoom);
    ctx.translate(-rect.x - rect.w * 0.5, -rect.y - rect.h * 0.5);

    // 1. Atmósfera y cielo
    if (state.layers.atmosphere) {
      const sky = computeSkyColors(sitio, solarNorm);
      const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      grad.addColorStop(0, rgbCss(sky.zenith, 1));
      grad.addColorStop(0.76, rgbCss(sky.horizon, 1));
      grad.addColorStop(1, rgbCss(sky.horizon, 0.9));
      ctx.fillStyle = grad;
      ctx.fillRect(rect.x - 40, rect.y - 40, rect.w + 80, rect.h + 80);

      // Campo estelar si atmósfera tenue o nocturna
      if (sky.starAlpha > 0.05) {
        for (const star of this.stars) {
          const twinkle =
            0.65 + 0.35 * Math.sin(this.simTimeSec * 1.4 + star.phase);
          ctx.fillStyle = `rgba(226, 232, 240, ${sky.starAlpha * twinkle})`;
          ctx.fillRect(
            rect.x + star.xFrac * rect.w,
            rect.y + star.yFrac * rect.h,
            star.size,
            star.size
          );
        }
      }

      // Disco solar y haces según irradiancia actual
      const phaseAngle = clamp((solarNorm - 0.05) * (Math.PI * 0.72), 0.05, Math.PI * 0.72);
      const sunX = rect.x + rect.w * (0.2 + 0.6 * (1 - solarNorm * 0.4));
      const sunY = rect.y + rect.h * (0.72 - Math.sin(phaseAngle) * 0.54);
      if (solarWm2 > 5) {
        const halo = ctx.createRadialGradient(sunX, sunY, 3, sunX, sunY, 54);
        halo.addColorStop(0, 'rgba(254, 240, 138, 0.92)');
        halo.addColorStop(0.3, `rgba(253, 224, 71, ${0.28 * solarNorm})`);
        halo.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 54, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FEF9C3';
        ctx.beginPath();
        ctx.arc(sunX, sunY, 6 + solarNorm * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Retícula de coordenadas métricas dentro de la escena
    if (state.layers.grid) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1;
      const cols = 6;
      const rows = 4;
      for (let i = 1; i < cols; i++) {
        const gx = rect.x + (rect.w * i) / cols;
        ctx.beginPath();
        ctx.moveTo(gx, rect.y);
        ctx.lineTo(gx, rect.y + rect.h);
        ctx.stroke();
      }
      for (let j = 1; j < rows; j++) {
        const gy = rect.y + (rect.h * j) / rows;
        ctx.beginPath();
        ctx.moveTo(rect.x, gy);
        ctx.lineTo(rect.x + rect.w, gy);
        ctx.stroke();
      }
    }

    // 3. Relieve topográfico y estratos minerales
    if (state.layers.terrain) {
      const palette = computeSoilPalette(sitio);
      const steps = 64;

      // Cordillera trasera de fondo
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y + rect.h);
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const elev =
          sampleTerrainElevationFrac(sitio, clamp(1 - f, 0, 1)) * 0.72 + 0.12;
        const px = rect.x + f * rect.w;
        const py = rect.y + rect.h * (1 - elev);
        ctx.lineTo(px, py);
      }
      ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
      ctx.closePath();
      ctx.fillStyle = rgbCss(palette.ridge, 0.78);
      ctx.fill();

      // Terreno principal con pendiente real y subsuelo
      const terrainGrad = ctx.createLinearGradient(
        rect.x,
        rect.y + rect.h * 0.45,
        rect.x,
        rect.y + rect.h
      );
      terrainGrad.addColorStop(0, rgbCss(palette.surface, 0.98));
      terrainGrad.addColorStop(1, rgbCss(palette.subsoil, 1));

      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y + rect.h);
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const elev = sampleTerrainElevationFrac(sitio, f);
        const px = rect.x + f * rect.w;
        const py = rect.y + rect.h * (1 - elev);
        ctx.lineTo(px, py);
      }
      ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
      ctx.closePath();
      ctx.fillStyle = terrainGrad;
      ctx.fill();

      // Cresta superior calibrada
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const elev = sampleTerrainElevationFrac(sitio, f);
        const px = rect.x + f * rect.w;
        const py = rect.y + rect.h * (1 - elev);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = side === 'A' ? 'rgba(6, 182, 212, 0.65)' : 'rgba(245, 158, 11, 0.65)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // 4. Vector de viento y partículas de polvo
    if (state.layers.wind && sitio.P[0] >= 20) {
      ctx.lineCap = 'round';
      for (const wp of this.windParticles) {
        if (wp.side !== side) continue;
        const px = rect.x + wp.xFrac * rect.w;
        const py = rect.y + wp.yFrac * rect.h;
        const streakLen = wp.len * (0.4 + clamp(windMs / 10, 0, 1.5));
        ctx.strokeStyle = `rgba(226, 232, 240, ${wp.alpha})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px - streakLen, py);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
    }

    // 5. Radiación cósmica (µSv/h)
    if (state.layers.radiation) {
      for (const r of this.radStreaks) {
        if (r.side !== side) continue;
        const px = rect.x + r.xFrac * rect.w;
        const py = rect.y + r.yFrac * rect.h;
        const fade = 1 - r.life / r.maxLife;
        ctx.strokeStyle = `rgba(244, 63, 94, ${0.75 * fade})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px - r.vx * 22, py - r.vy * 22);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
    }

    // 6. Sondas balísticas de gravedad (g_A vs g_B)
    if (state.layers.physics) {
      for (const probe of this.probes) {
        if (probe.side !== side) continue;

        // Trayectoria
        if (probe.trail.length > 1) {
          ctx.beginPath();
          probe.trail.forEach((pt, idxTrail) => {
            const tx = rect.x + pt.xNorm * rect.w;
            const ty = rect.y + rect.h * (1 - pt.yMeters / 40);
            if (idxTrail === 0) ctx.moveTo(tx, ty);
            else ctx.lineTo(tx, ty);
          });
          ctx.strokeStyle = side === 'A' ? 'rgba(6, 182, 212, 0.55)' : 'rgba(245, 158, 11, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        const px = rect.x + probe.xNorm * rect.w;
        const py = rect.y + rect.h * (1 - probe.yMeters / 40);

        // Cuerpo de sonda
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(px, py, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Etiqueta de velocidad instantánea
        ctx.font = `500 10px ${FONT_MONO}`;
        ctx.fillStyle = COLOR_TEXT;
        ctx.fillText(
          `vy=${probe.vyMeters.toFixed(1)} m/s`,
          clamp(px + 9, rect.x + 8, rect.x + rect.w - 92),
          clamp(py - 6, rect.y + 20, rect.y + rect.h - 10)
        );
      }
    }

    ctx.restore(); // fin transform cámara

    // HUD fijo sobre el viewport físico
    ctx.fillStyle = 'rgba(7, 9, 14, 0.72)';
    ctx.fillRect(rect.x + 10, rect.y + 10, Math.min(rect.w - 20, 320), 46);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 10, rect.y + 10, Math.min(rect.w - 20, 320), 46);

    ctx.font = `600 12px ${FONT_SANS}`;
    ctx.fillStyle = accent;
    ctx.fillText(`SITIO ${side} · ${sitio.nombre}`, rect.x + 18, rect.y + 28, Math.min(rect.w - 36, 304));

    ctx.font = `500 11px ${FONT_MONO}`;
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText(
      `g=${sitio.g.toFixed(2)} m/s² · pend=${sitio.pendiente}° · rad=${sitio.radiacion} µSv/h`,
      rect.x + 18,
      rect.y + 46,
      Math.min(rect.w - 36, 304)
    );

    // Banda inferior de telemetría instantánea en t
    const barH = 26;
    ctx.fillStyle = 'rgba(7, 9, 14, 0.8)';
    ctx.fillRect(rect.x, rect.y + rect.h - barH, rect.w, barH);
    ctx.font = `500 11px ${FONT_MONO}`;
    ctx.fillStyle = COLOR_TEXT;
    const readout = `T: ${tempK.toFixed(1)} K   P: ${presPa.toFixed(0)} Pa   V: ${windMs.toFixed(1)} m/s   Luz: ${solarWm2.toFixed(0)} W/m²`;
    ctx.fillText(readout, rect.x + 12, rect.y + rect.h - 9, rect.w - 24);

    // Borde exterior de sub-panel
    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
    ctx.restore();
  }

  private renderRadarScope(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    state: CanvasEngineSceneState
  ) {
    ctx.save();
    ctx.fillStyle = COLOR_PANEL;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

    ctx.font = `600 11px ${FONT_SANS}`;
    ctx.fillStyle = COLOR_TEXT;
    ctx.fillText('Radar 9D de Similitud', rect.x + 12, rect.y + 20);

    ctx.font = `600 12px ${FONT_MONO}`;
    ctx.fillStyle = state.resultado.penalizado ? COLOR_AMBER : COLOR_CYAN;
    const pctText = `${state.resultado.total.toFixed(1)}%`;
    const m = ctx.measureText(pctText);
    ctx.fillText(pctText, rect.x + rect.w - m.width - 12, rect.y + 20);

    const cx = rect.x + rect.w * 0.5;
    const cy = rect.y + rect.h * 0.55;
    const radius = Math.max(28, Math.min(rect.w * 0.34, (rect.h - 54) * 0.42));
    const count = ORDEN_VARIABLES.length;

    // Anillos de referencia (25, 50, 75, 100%)
    for (const frac of [0.25, 0.5, 0.75, 1]) {
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count - Math.PI / 2;
        const px = cx + Math.cos(ang) * radius * frac;
        const py = cy + Math.sin(ang) * radius * frac;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle =
        frac === 1 ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Ejes radiales y etiquetas
    ctx.font = `500 9px ${FONT_MONO}`;
    ORDEN_VARIABLES.forEach((v, i) => {
      const ang = (Math.PI * 2 * i) / count - Math.PI / 2;
      const ex = cx + Math.cos(ang) * radius;
      const ey = cy + Math.sin(ang) * radius;

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      const lx = cx + Math.cos(ang) * (radius + 14);
      const ly = cy + Math.sin(ang) * (radius + 12);
      const shortAxisLabels: Record<VariableAnalogo, string> = {
        temperatura: 'TEMP',
        presion: 'PRES',
        viento: 'VIENTO',
        luz: 'LUZ',
        gravedad: 'GRAV',
        radiacion: 'RAD',
        aire: 'AIRE',
        suelo: 'SUELO',
        terreno: 'TERR',
      };
      const label = shortAxisLabels[v];
      const isCrit = state.criticas.includes(v);
      ctx.fillStyle = isCrit ? '#FCD34D' : COLOR_MUTED;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx, ly);
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Polígono de similitud por eje
    ctx.beginPath();
    ORDEN_VARIABLES.forEach((v, i) => {
      const val = clamp(state.resultado.porVariable[v] / 100, 0.03, 1);
      const ang = (Math.PI * 2 * i) / count - Math.PI / 2;
      const px = cx + Math.cos(ang) * radius * val;
      const py = cy + Math.sin(ang) * radius * val;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
    ctx.fill();
    ctx.strokeStyle = COLOR_CYAN;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Vértices resaltando críticas en riesgo
    ORDEN_VARIABLES.forEach((v, i) => {
      const sim = state.resultado.porVariable[v];
      const val = clamp(sim / 100, 0.03, 1);
      const ang = (Math.PI * 2 * i) / count - Math.PI / 2;
      const px = cx + Math.cos(ang) * radius * val;
      const py = cy + Math.sin(ang) * radius * val;
      const isCritLow = state.criticas.includes(v) && sim < 25;
      ctx.fillStyle = isCritLow ? COLOR_ROSE : COLOR_CYAN;
      ctx.beginPath();
      ctx.arc(px, py, isCritLow ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  private renderOscilloscope(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    state: CanvasEngineSceneState
  ) {
    ctx.save();
    ctx.fillStyle = COLOR_PANEL;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

    const ch = state.oscChannel;
    const arrA = state.resultado.seriesA[ch];
    const arrB = state.resultado.seriesB[ch];
    const n = Math.max(2, arrA.length);
    const unitMap: Record<OscilloscopeChannel, string> = {
      temperatura: 'K',
      luz: 'W/m²',
      viento: 'm/s',
      presion: 'Pa',
    };

    const allVals = [...arrA, ...arrB];
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const span = Math.max(1e-6, maxVal - minVal);

    // Cabecera
    ctx.font = `600 11px ${FONT_SANS}`;
    ctx.fillStyle = COLOR_TEXT;
    ctx.fillText(`Osciloscopio · ${ch.toUpperCase()} (${unitMap[ch]})`, rect.x + 12, rect.y + 20);

    const corr = state.resultado.correlacionTemporal[ch];
    ctx.font = `500 11px ${FONT_MONO}`;
    ctx.fillStyle = COLOR_MUTED;
    const corrStr = corr !== null ? `r = ${corr >= 0 ? '+' : ''}${corr.toFixed(2)}` : 'r = —';
    const cm = ctx.measureText(corrStr);
    ctx.fillText(corrStr, rect.x + rect.w - cm.width - 12, rect.y + 20);

    const plot: Rect = {
      x: rect.x + 48,
      y: rect.y + 34,
      w: Math.max(40, rect.w - 64),
      h: Math.max(40, rect.h - 60),
    };

    // Grilla horizontal
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    ctx.font = `400 9px ${FONT_MONO}`;
    ctx.fillStyle = COLOR_MUTED;
    for (let g = 0; g <= 3; g++) {
      const f = g / 3;
      const gy = plot.y + plot.h * f;
      ctx.beginPath();
      ctx.moveTo(plot.x, gy);
      ctx.lineTo(plot.x + plot.w, gy);
      ctx.stroke();

      const labelVal = maxVal - span * f;
      ctx.fillText(
        labelVal >= 1000 ? labelVal.toFixed(0) : labelVal.toFixed(1),
        rect.x + 6,
        gy + 3
      );
    }

    const drawWave = (arr: number[], color: string) => {
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const px = plot.x + (i / (n - 1)) * plot.w;
        const py = plot.y + plot.h - ((arr[i] - minVal) / span) * plot.h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    };

    drawWave(arrA, COLOR_CYAN);
    drawWave(arrB, COLOR_AMBER);

    // Cabezal de tiempo animado
    const cursorFrac = clamp(state.sampleCursor / (n - 1), 0, 1);
    const playX = plot.x + cursorFrac * plot.w;
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.65)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(playX, plot.y);
    ctx.lineTo(playX, plot.y + plot.h);
    ctx.stroke();
    ctx.setLineDash([]);

    const idx = clamp(Math.floor(state.sampleCursor), 0, n - 1);
    const valA = arrA[idx] ?? 0;
    const valB = arrB[idx] ?? 0;
    const yA = plot.y + plot.h - ((valA - minVal) / span) * plot.h;
    const yB = plot.y + plot.h - ((valB - minVal) / span) * plot.h;

    ctx.fillStyle = COLOR_CYAN;
    ctx.beginPath();
    ctx.arc(playX, yA, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLOR_AMBER;
    ctx.beginPath();
    ctx.arc(playX, yB, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Leyenda inferior
    ctx.font = `500 10px ${FONT_MONO}`;
    ctx.fillStyle = COLOR_CYAN;
    ctx.fillText(`A: ${valA.toFixed(1)} ${unitMap[ch]}`, plot.x, rect.y + rect.h - 9);
    ctx.fillStyle = COLOR_AMBER;
    ctx.fillText(`B: ${valB.toFixed(1)} ${unitMap[ch]}`, plot.x + 115, rect.y + rect.h - 9);
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText(
      `t=${(state.resultado.seriesA.t[idx] ?? 0).toFixed(1)}h`,
      plot.x + plot.w - 58,
      rect.y + rect.h - 9
    );

    ctx.restore();
  }

  private renderCompositionMatrix(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    state: CanvasEngineSceneState
  ) {
    ctx.save();
    ctx.fillStyle = COLOR_PANEL;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

    ctx.font = `600 11px ${FONT_SANS}`;
    ctx.fillStyle = COLOR_TEXT;
    ctx.fillText('Matriz Química (Suelo · Aire)', rect.x + 12, rect.y + 20);

    const oxides = ['SiO2', 'Al2O3', 'Fe2O3', 'CaO', 'MgO'];
    const rowStart = rect.y + 36;
    const rowH = Math.min(26, (rect.h - 74) / oxides.length);
    const barStart = rect.x + 58;
    const barW = Math.max(40, rect.w - 108);

    oxides.forEach((ox, i) => {
      const y = rowStart + i * rowH;
      const vA = clamp(state.sitioA.suelo[ox] ?? 0, 0, 1);
      const vB = clamp(state.sitioB.suelo[ox] ?? 0, 0, 1);

      ctx.font = `500 10px ${FONT_MONO}`;
      ctx.fillStyle = COLOR_MUTED;
      ctx.fillText(ox, rect.x + 12, y + 11);

      // Pista barra A
      ctx.fillStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.fillRect(barStart, y + 2, barW, 5);
      ctx.fillStyle = COLOR_CYAN;
      ctx.fillRect(barStart, y + 2, barW * vA, 5);

      // Pista barra B
      ctx.fillStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.fillRect(barStart, y + 9, barW, 5);
      ctx.fillStyle = COLOR_AMBER;
      ctx.fillRect(barStart, y + 9, barW * vB, 5);

      ctx.font = `400 9px ${FONT_MONO}`;
      ctx.fillStyle = COLOR_TEXT;
      ctx.fillText(
        `${Math.round(vA * 100)}/${Math.round(vB * 100)}%`,
        barStart + barW + 6,
        y + 11
      );
    });

    // Totales Aire vs Suelo TVD
    const footY = rect.y + rect.h - 14;
    ctx.font = `500 10px ${FONT_MONO}`;
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText(
      `Aire: ${state.resultado.porVariable.aire.toFixed(1)}% · Suelo: ${state.resultado.porVariable.suelo.toFixed(1)}%`,
      rect.x + 12,
      footY,
      rect.w - 24
    );

    ctx.restore();
  }

  private renderPointerCrosshair(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: CanvasEngineSceneState
  ) {
    const { x, y } = state.pointer;
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}
