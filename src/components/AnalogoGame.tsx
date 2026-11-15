import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Compass,
  ExternalLink,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ANALOGOS_LUNA_MARTE_PDS,
  ANALOGOS_TERRESTRES_NASA,
} from '../lib/analogo';
import { gameAudio } from '../lib/gameAudio';

export type GameState =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'ROUND_SUMMARY'
  | 'VICTORY'
  | 'GAME_OVER';

export interface PlayableLocation {
  id: string;
  body: 'Tierra' | 'Marte' | 'Luna';
  name: string;
  sourceLabel: string;
  lat: number;
  lon: number;
  tempK: number;
  pressurePa: number;
  windMs: number;
  gravity: number;
  radiation: number;
  slopeDeg: number;
  roughness: number;
  soil: Record<string, number>;
}

interface SampleNode {
  id: number;
  x: number;
  y: number;
  oxide: string;
  pct: number;
  collected: boolean;
  revealedTimer: number;
  pulsePhase: number;
}

interface CraterObstacle {
  x: number;
  y: number;
  r: number;
  seed: number;
}

interface HazardZone {
  id: number;
  kind: 'vortex' | 'meteor';
  x: number;
  y: number;
  radius: number;
  telegraph: number; // counts down 1.25 -> 0
  activeTimer: number; // active shock window
  triggered: boolean;
}

interface PatrolDrone {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface ScanWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

interface MapsBriefingPlace {
  title: string;
  uri: string;
}

interface MapsBriefingData {
  respuestaMarkdown: string;
  lugares: MapsBriefingPlace[];
}

interface HudSnapshot {
  sector: number;
  totalSectors: number;
  location: PlayableLocation;
  integrity: number;
  score: number;
  samplesCollected: number;
  samplesTotal: number;
  beaconActive: boolean;
  scannerCooldown: number;
  scannerMaxCooldown: number;
  elapsedSec: number;
  hitsTaken: number;
}

interface AnalogoGameProps {
  initialLocationId?: string;
  onExitToLab: () => void;
}

const BACKDROP_URL = '/src/assets/images/rover_mission_backdrop_1794737830833.jpg';
const HIGH_SCORE_KEY = 'analogo_rover_best_score_v1';

const PLAYABLE_LOCATIONS: PlayableLocation[] = [
  ...ANALOGOS_TERRESTRES_NASA.map((t) => ({
    id: t.id,
    body: 'Tierra' as const,
    name: t.nombre,
    sourceLabel: 'NASA Earthdata',
    lat: t.lat,
    lon: t.lon,
    tempK: t.T[0],
    pressurePa: t.P[0],
    windMs: t.viento[0],
    gravity: 9.81,
    radiation: t.radiacion,
    slopeDeg: t.pendiente,
    roughness: t.rugosidad,
    soil: t.suelo,
  })),
  ...ANALOGOS_LUNA_MARTE_PDS.map((p) => ({
    id: p.id,
    body: (p.cuerpo === 'marte' ? 'Marte' : 'Luna') as 'Marte' | 'Luna',
    name: p.nombre,
    sourceLabel: p.misionFuente,
    lat: p.lat,
    lon: p.lon,
    tempK: p.T[0],
    pressurePa: p.P[0],
    windMs: p.viento[0],
    gravity: p.g,
    radiation: p.radiacion,
    slopeDeg: p.pendiente,
    roughness: p.rugosidad,
    soil: p.suelo,
  })),
];

const BODY_PALETTES = {
  Tierra: {
    bg: '#1c1814',
    grid: 'rgba(217, 155, 86, 0.12)',
    craterFill: '#2c241d',
    craterStroke: '#574636',
    dust: '#d99b56',
    accent: '#38bdf8',
  },
  Marte: {
    bg: '#23110d',
    grid: 'rgba(234, 88, 12, 0.14)',
    craterFill: '#3b1c15',
    craterStroke: '#7c2d12',
    dust: '#ea580c',
    accent: '#fb923c',
  },
  Luna: {
    bg: '#14171f',
    grid: 'rgba(148, 163, 184, 0.12)',
    craterFill: '#242936',
    craterStroke: '#475569',
    dust: '#94a3b8',
    accent: '#60a5fa',
  },
};

function buildSectorSequence(startLocation: PlayableLocation): PlayableLocation[] {
  const earths = PLAYABLE_LOCATIONS.filter((l) => l.body === 'Tierra');
  const mars = PLAYABLE_LOCATIONS.filter((l) => l.body === 'Marte');
  const moons = PLAYABLE_LOCATIONS.filter((l) => l.body === 'Luna');

  const pickDifferent = (pool: PlayableLocation[], excludeId: string) =>
    pool.find((item) => item.id !== excludeId) ?? pool[0];

  if (startLocation.body === 'Tierra') {
    return [startLocation, mars[0], moons[0]];
  }
  if (startLocation.body === 'Marte') {
    return [startLocation, moons[0], pickDifferent(mars, startLocation.id)];
  }
  return [startLocation, mars[0], pickDifferent(earths, startLocation.id)];
}

function getDominantOxides(soil: Record<string, number>): Array<[string, number]> {
  const entries = Object.entries(soil)
    .filter(([k]) => k !== 'otros')
    .sort((a, b) => b[1] - a[1]);
  return entries.length > 0 ? entries : [['SiO2', 0.5]];
}

export const AnalogoGame: React.FC<AnalogoGameProps> = ({
  initialLocationId,
  onExitToLab,
}) => {
  const defaultLoc = useMemo(() => {
    return (
      PLAYABLE_LOCATIONS.find((l) => l.id === initialLocationId) ??
      PLAYABLE_LOCATIONS.find((l) => l.id === 'marte-gale-curiosity') ??
      PLAYABLE_LOCATIONS[0]
    );
  }, [initialLocationId]);

  const [selectedLocId, setSelectedLocId] = useState<string>(defaultLoc.id);
  const [bodyFilter, setBodyFilter] = useState<'Todos' | 'Tierra' | 'Marte' | 'Luna'>('Todos');
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [muted, setMuted] = useState<boolean>(false);
  const [backdropFailed, setBackdropFailed] = useState<boolean>(false);
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(HIGH_SCORE_KEY) || 0) || 0;
    } catch {
      return 0;
    }
  });

  const selectedLocation = useMemo(
    () =>
      PLAYABLE_LOCATIONS.find((l) => l.id === selectedLocId) ?? defaultLoc,
    [selectedLocId, defaultLoc]
  );

  const filteredLocations = useMemo(() => {
    if (bodyFilter === 'Todos') return PLAYABLE_LOCATIONS;
    return PLAYABLE_LOCATIONS.filter((l) => l.body === bodyFilter);
  }, [bodyFilter]);

  const [hud, setHud] = useState<HudSnapshot>({
    sector: 1,
    totalSectors: 3,
    location: defaultLoc,
    integrity: 100,
    score: 0,
    samplesCollected: 0,
    samplesTotal: 5,
    beaconActive: false,
    scannerCooldown: 0,
    scannerMaxCooldown: 2.4,
    elapsedSec: 0,
    hitsTaken: 0,
  });

  const [mapsBriefing, setMapsBriefing] = useState<MapsBriefingData | null>(null);
  const [mapsLoading, setMapsLoading] = useState<boolean>(false);
  const [mapsError, setMapsError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameStateRef = useRef<GameState>('TITLE_MENU');
  gameStateRef.current = gameState;

  // Engine mutable state isolated from React renders
  const engineRef = useRef<{
    width: number;
    height: number;
    sectors: PlayableLocation[];
    sectorIndex: number;
    rover: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      angle: number;
      r: number;
      squash: number;
      invuln: number;
      hitFlash: number;
    };
    beacon: { x: number; y: number; r: number; pulse: number };
    samples: SampleNode[];
    craters: CraterObstacle[];
    hazards: HazardZone[];
    drones: PatrolDrone[];
    particles: Particle[];
    scanWaves: ScanWave[];
    integrity: number;
    score: number;
    elapsedSec: number;
    hitsTaken: number;
    scannerCooldown: number;
    scannerMaxCooldown: number;
    hazardSpawnTimer: number;
    nextHazardId: number;
    hitstopTimer: number;
    shakeTime: number;
    shakeMag: number;
    pointerTarget: { active: boolean; x: number; y: number };
    lastHudSync: number;
  }>({
    width: 1024,
    height: 640,
    sectors: [defaultLoc],
    sectorIndex: 0,
    rover: {
      x: 180,
      y: 320,
      vx: 0,
      vy: 0,
      angle: 0,
      r: 15,
      squash: 1,
      invuln: 0,
      hitFlash: 0,
    },
    beacon: { x: 860, y: 320, r: 28, pulse: 0 },
    samples: [],
    craters: [],
    hazards: [],
    drones: [],
    particles: Array.from({ length: 160 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      color: '#fff',
    })),
    scanWaves: [],
    integrity: 100,
    score: 0,
    elapsedSec: 0,
    hitsTaken: 0,
    scannerCooldown: 0,
    scannerMaxCooldown: 2.4,
    hazardSpawnTimer: 1.5,
    nextHazardId: 1,
    hitstopTimer: 0,
    shakeTime: 0,
    shakeMag: 0,
    pointerTarget: { active: false, x: 0, y: 0 },
    lastHudSync: 0,
  });

  const heldKeysRef = useRef<Set<string>>(new Set());
  const justPressedRef = useRef<Set<string>>(new Set());

  const saveHighScore = useCallback((candidate: number) => {
    setBestScore((prev) => {
      const next = Math.max(prev, candidate);
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  }, []);

  const spawnBurst = useCallback(
    (x: number, y: number, count: number, color: string, speed = 130) => {
      const pool = engineRef.current.particles;
      let spawned = 0;
      for (let i = 0; i < pool.length && spawned < count; i++) {
        if (!pool[i].active) {
          const ang = Math.random() * Math.PI * 2;
          const spd = speed * (0.35 + Math.random() * 0.85);
          pool[i].active = true;
          pool[i].x = x;
          pool[i].y = y;
          pool[i].vx = Math.cos(ang) * spd;
          pool[i].vy = Math.sin(ang) * spd;
          pool[i].maxLife = 0.35 + Math.random() * 0.4;
          pool[i].life = pool[i].maxLife;
          pool[i].size = 2 + Math.random() * 3;
          pool[i].color = color;
          spawned++;
        }
      }
    },
    []
  );

  const setupSector = useCallback((sectorIdx: number, carryIntegrity: number, carryScore: number) => {
    const st = engineRef.current;
    const w = Math.max(640, st.width);
    const h = Math.max(420, st.height);
    const loc = st.sectors[sectorIdx] ?? st.sectors[0];

    st.sectorIndex = sectorIdx;
    st.integrity = carryIntegrity;
    st.score = carryScore;
    st.scannerCooldown = 0;
    st.hazardSpawnTimer = Math.max(0.8, 2.2 - sectorIdx * 0.45);
    st.hitstopTimer = 0;
    st.shakeTime = 0;
    st.shakeMag = 0;
    st.hazards = [];
    st.scanWaves = [];
    st.pointerTarget.active = false;
    for (const p of st.particles) p.active = false;

    const startX = Math.max(90, w * 0.14);
    const startY = h * 0.5;
    st.rover = {
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      angle: 0,
      r: 15,
      squash: 1,
      invuln: 1.0,
      hitFlash: 0,
    };

    st.beacon = {
      x: Math.min(w - 90, w * 0.86),
      y: h * 0.5,
      r: 28,
      pulse: 0,
    };

    // Obstacles driven by real terrain slope & roughness
    const craterCount = Math.min(
      14,
      Math.max(4, Math.round(loc.slopeDeg * 0.45 + loc.roughness * 40 + sectorIdx * 2))
    );
    const craters: CraterObstacle[] = [];
    let guard = 0;
    while (craters.length < craterCount && guard < 200) {
      guard++;
      const r = 20 + ((guard * 17) % 24);
      const x = 140 + Math.random() * (w - 280);
      const y = 70 + Math.random() * (h - 140);
      const distStart = Math.hypot(x - startX, y - startY);
      const distBeacon = Math.hypot(x - st.beacon.x, y - st.beacon.y);
      if (distStart < r + 75 || distBeacon < r + 80) continue;
      const overlaps = craters.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + r + 32);
      if (!overlaps) {
        craters.push({ x, y, r, seed: guard });
      }
    }
    st.craters = craters;

    // Mineral samples drawn from the real soil oxide breakdown
    const oxides = getDominantOxides(loc.soil);
    const totalSamples = 4 + (sectorIdx + 1);
    const samples: SampleNode[] = [];
    let sGuard = 0;
    while (samples.length < totalSamples && sGuard < 300) {
      sGuard++;
      const x = 110 + Math.random() * (w - 220);
      const y = 68 + Math.random() * (h - 136);
      const distStart = Math.hypot(x - startX, y - startY);
      const distBeacon = Math.hypot(x - st.beacon.x, y - st.beacon.y);
      const inCrater = craters.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + 22);
      const nearSample = samples.some((s) => Math.hypot(s.x - x, s.y - y) < 68);
      if (distStart < 90 || distBeacon < 70 || inCrater || nearSample) continue;
      const [oxide, frac] = oxides[samples.length % oxides.length];
      samples.push({
        id: samples.length + 1,
        x,
        y,
        oxide,
        pct: Math.round(frac * 100),
        collected: false,
        revealedTimer: 0,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    st.samples = samples;

    // Autonomous hazard patrols in Sectors 2 & 3
    const drones: PatrolDrone[] = [];
    const droneCount = sectorIdx === 0 ? 0 : sectorIdx === 1 ? 2 : 3;
    for (let i = 0; i < droneCount; i++) {
      const px = w * (0.35 + i * 0.22);
      const py = h * (i % 2 === 0 ? 0.26 : 0.74);
      const spd = 88 + sectorIdx * 24;
      drones.push({
        x: px,
        y: py,
        vx: (i % 2 === 0 ? 1 : -1) * spd * 0.7,
        vy: (i % 2 === 0 ? -1 : 1) * spd * 0.7,
        r: 13,
        phase: i * 1.4,
      });
    }
    st.drones = drones;

    setMapsBriefing(null);
    setMapsError(null);

    setHud({
      sector: sectorIdx + 1,
      totalSectors: st.sectors.length,
      location: loc,
      integrity: Math.round(st.integrity),
      score: Math.round(st.score),
      samplesCollected: 0,
      samplesTotal: samples.length,
      beaconActive: false,
      scannerCooldown: 0,
      scannerMaxCooldown: st.scannerMaxCooldown,
      elapsedSec: Math.round(st.elapsedSec),
      hitsTaken: st.hitsTaken,
    });
  }, []);

  const startNewCampaign = useCallback(() => {
    const seq = buildSectorSequence(selectedLocation);
    engineRef.current.sectors = seq;
    engineRef.current.elapsedSec = 0;
    engineRef.current.hitsTaken = 0;
    heldKeysRef.current.clear();
    justPressedRef.current.clear();
    setupSector(0, 100, 0);
    setGameState('PLAYING');
    gameAudio.playScanPulse();
  }, [selectedLocation, setupSector]);

  const advanceToNextSector = useCallback(() => {
    const st = engineRef.current;
    const nextIdx = st.sectorIndex + 1;
    if (nextIdx >= st.sectors.length) {
      saveHighScore(Math.round(st.score));
      gameAudio.playVictory();
      setGameState('VICTORY');
      return;
    }
    const heal = Math.min(100, st.integrity + 25);
    heldKeysRef.current.clear();
    justPressedRef.current.clear();
    setupSector(nextIdx, heal, st.score);
    setGameState('PLAYING');
    gameAudio.playScanPulse();
  }, [saveHighScore, setupSector]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      gameAudio.setMuted(next);
      return next;
    });
  }, []);

  const triggerScanBoost = useCallback(() => {
    const st = engineRef.current;
    if (gameStateRef.current !== 'PLAYING') return;
    if (st.scannerCooldown > 0.05) return;

    const loc = st.sectors[st.sectorIndex];
    const gravRatio = Math.max(0.4, Math.min(1.4, 9.81 / Math.max(1.2, loc.gravity)));
    const boostImpulse = 260 + gravRatio * 60;
    const dirX = Math.cos(st.rover.angle);
    const dirY = Math.sin(st.rover.angle);
    st.rover.vx += dirX * boostImpulse;
    st.rover.vy += dirY * boostImpulse;
    st.rover.squash = 1.28;
    st.scannerCooldown = st.scannerMaxCooldown;

    st.scanWaves.push({
      x: st.rover.x,
      y: st.rover.y,
      radius: 16,
      maxRadius: 230,
      alpha: 0.95,
    });

    for (const sample of st.samples) {
      if (!sample.collected && Math.hypot(sample.x - st.rover.x, sample.y - st.rover.y) < 235) {
        sample.revealedTimer = 3.5;
      }
    }

    spawnBurst(
      st.rover.x - dirX * 14,
      st.rover.y - dirY * 14,
      14,
      BODY_PALETTES[loc.body].accent,
      145
    );
    gameAudio.playScanPulse();
  }, [spawnBurst]);

  const fetchEarthSectorBriefing = useCallback(async () => {
    const loc = hud.location;
    if (loc.body !== 'Tierra') return;
    setMapsLoading(true);
    setMapsError(null);
    try {
      const res = await fetch('/api/earthdata/maps-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consulta: `Resumen breve de campo y puntos de acceso cercanos para una expedición científica en ${loc.name}`,
          lat: loc.lat,
          lon: loc.lon,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo consultar Google Maps Grounding');
      }
      setMapsBriefing({
        respuestaMarkdown: data.respuestaMarkdown,
        lugares: Array.isArray(data.lugares) ? data.lugares : [],
      });
    } catch (err) {
      setMapsError(
        err instanceof Error ? err.message : 'Error consultando Google Maps Grounding'
      );
    } finally {
      setMapsLoading(false);
    }
  }, [hud.location]);

  // Keyboard listener with held-key isolation + window.blur reset
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      if (!e.repeat) {
        justPressedRef.current.add(e.code);

        if (e.code === 'KeyM') {
          toggleMute();
          return;
        }

        const curr = gameStateRef.current;
        if (curr === 'TITLE_MENU' && (e.code === 'Enter' || e.code === 'Space')) {
          startNewCampaign();
          return;
        }
        if (curr === 'PLAYING' && e.code === 'Escape') {
          heldKeysRef.current.clear();
          setGameState('PAUSED');
          return;
        }
        if (curr === 'PAUSED' && e.code === 'Escape') {
          setGameState('PLAYING');
          return;
        }
        if (curr === 'PLAYING' && e.code === 'Space') {
          triggerScanBoost();
        }
      }

      heldKeysRef.current.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.code);
    };

    const onBlur = () => {
      heldKeysRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [startNewCampaign, toggleMute, triggerScanBoost]);

  // Canvas resize observer
  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    const resize = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(320, Math.floor(rect.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      engineRef.current.width = w;
      engineRef.current.height = h;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Main isolated requestAnimationFrame loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const applyDamage = (amount: number, knockX: number, knockY: number) => {
      const st = engineRef.current;
      if (st.rover.invuln > 0) return;

      st.integrity = Math.max(0, st.integrity - amount);
      st.hitsTaken += 1;
      st.rover.invuln = 1.05;
      st.rover.hitFlash = 0.22;
      st.rover.squash = 0.72;
      st.rover.vx += knockX;
      st.rover.vy += knockY;
      st.hitstopTimer = 0.045;
      st.shakeTime = 0.28;
      st.shakeMag = 9;
      spawnBurst(st.rover.x, st.rover.y, 18, '#f43f5e', 175);
      gameAudio.playImpact();

      if (st.integrity <= 0) {
        saveHighScore(Math.round(st.score));
        gameAudio.playGameOver();
        setGameState('GAME_OVER');
      }
    };

    const tick = (now: number) => {
      const rawDt = (now - lastTs) / 1000;
      lastTs = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const st = engineRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (canvas && ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = st.width;
        const h = st.height;
        const loc = st.sectors[st.sectorIndex] ?? defaultLoc;
        const palette = BODY_PALETTES[loc.body];

        // Update physics ONLY when PLAYING
        if (gameStateRef.current === 'PLAYING') {
          if (st.hitstopTimer > 0) {
            st.hitstopTimer -= dt;
          } else {
            st.elapsedSec += dt;
            st.beacon.pulse += dt * 3;
            st.scannerCooldown = Math.max(0, st.scannerCooldown - dt);
            st.rover.invuln = Math.max(0, st.rover.invuln - dt);
            st.rover.hitFlash = Math.max(0, st.rover.hitFlash - dt);
            st.rover.squash += (1 - st.rover.squash) * Math.min(1, dt * 11);

            // Input vector (keyboard + optional pointer drag)
            const keys = heldKeysRef.current;
            let ix = 0;
            let iy = 0;
            if (keys.has('KeyW') || keys.has('ArrowUp')) iy -= 1;
            if (keys.has('KeyS') || keys.has('ArrowDown')) iy += 1;
            if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
            if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;

            if (ix === 0 && iy === 0 && st.pointerTarget.active) {
              const pdx = st.pointerTarget.x - st.rover.x;
              const pdy = st.pointerTarget.y - st.rover.y;
              const pdist = Math.hypot(pdx, pdy);
              if (pdist > 14) {
                ix = pdx / pdist;
                iy = pdy / pdist;
              }
            }

            const mag = Math.hypot(ix, iy);
            if (mag > 1) {
              ix /= mag;
              iy /= mag;
            }

            // Planetary physics coupling: gravity governs traction/damping, wind induces gentle drift
            const gravityFactor = Math.max(0.28, Math.min(1.1, loc.gravity / 9.81));
            const accel = 580 + (1 - gravityFactor) * 140;
            const damping = 3.2 + gravityFactor * 2.8;
            const windDriftX = loc.windMs * 5.2;
            const windDriftY = Math.sin(st.elapsedSec * 0.7) * loc.windMs * 1.8;

            st.rover.vx += (ix * accel + windDriftX) * dt;
            st.rover.vy += (iy * accel + windDriftY) * dt;
            st.rover.vx *= Math.exp(-damping * dt);
            st.rover.vy *= Math.exp(-damping * dt);

            st.rover.x += st.rover.vx * dt;
            st.rover.y += st.rover.vy * dt;

            if (Math.hypot(st.rover.vx, st.rover.vy) > 18) {
              const targetAngle = Math.atan2(st.rover.vy, st.rover.vx);
              let diff = targetAngle - st.rover.angle;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              st.rover.angle += diff * Math.min(1, dt * 12);
            }

            // Bounds clamp
            const pad = 26;
            if (st.rover.x < pad) {
              st.rover.x = pad;
              st.rover.vx *= -0.35;
            } else if (st.rover.x > w - pad) {
              st.rover.x = w - pad;
              st.rover.vx *= -0.35;
            }
            if (st.rover.y < pad) {
              st.rover.y = pad;
              st.rover.vy *= -0.35;
            } else if (st.rover.y > h - pad) {
              st.rover.y = h - pad;
              st.rover.vy *= -0.35;
            }

            // Crater solid collisions
            for (const c of st.craters) {
              const dx = st.rover.x - c.x;
              const dy = st.rover.y - c.y;
              const dist = Math.hypot(dx, dy);
              const minD = c.r + st.rover.r;
              if (dist < minD && dist > 0.001) {
                const nx = dx / dist;
                const ny = dy / dist;
                st.rover.x = c.x + nx * minD;
                st.rover.y = c.y + ny * minD;
                const impactSpd = -(st.rover.vx * nx + st.rover.vy * ny);
                if (impactSpd > 15) {
                  st.rover.vx += nx * impactSpd * 1.25;
                  st.rover.vy += ny * impactSpd * 1.25;
                }
              }
            }

            // Sample collection + scan magnetism
            let collectedCount = 0;
            for (const s of st.samples) {
              if (s.collected) {
                collectedCount++;
                continue;
              }
              s.pulsePhase += dt * 4;
              if (s.revealedTimer > 0) {
                s.revealedTimer = Math.max(0, s.revealedTimer - dt);
                const dx = st.rover.x - s.x;
                const dy = st.rover.y - s.y;
                const d = Math.hypot(dx, dy);
                if (d < 165 && d > 1) {
                  s.x += (dx / d) * 85 * dt;
                  s.y += (dy / d) * 85 * dt;
                }
              }
              if (Math.hypot(s.x - st.rover.x, s.y - st.rover.y) < st.rover.r + 16) {
                s.collected = true;
                collectedCount++;
                st.score += 150 + st.sectorIndex * 50;
                st.rover.squash = 1.22;
                spawnBurst(s.x, s.y, 16, '#34d399', 150);
                gameAudio.playSampleCollect();
              }
            }

            const allSamplesCollected =
              collectedCount >= st.samples.length && st.samples.length > 0;

            // Relay beacon extraction
            if (
              allSamplesCollected &&
              Math.hypot(st.beacon.x - st.rover.x, st.beacon.y - st.rover.y) <
                st.beacon.r + st.rover.r
            ) {
              const sectorBonus = 300 + Math.round(st.integrity * 3);
              st.score += sectorBonus;
              spawnBurst(st.beacon.x, st.beacon.y, 26, '#38bdf8', 210);
              gameAudio.playRelayUplink();

              if (st.sectorIndex + 1 >= st.sectors.length) {
                saveHighScore(Math.round(st.score));
                gameAudio.playVictory();
                setGameState('VICTORY');
              } else {
                setGameState('ROUND_SUMMARY');
              }
            }

            // Spawn telegraphed hazards based on radiation & wind
            st.hazardSpawnTimer -= dt;
            if (st.hazardSpawnTimer <= 0) {
              const baseCadence = Math.max(1.35, 3.0 - st.sectorIndex * 0.45 - Math.min(0.6, loc.radiation * 0.008));
              st.hazardSpawnTimer = baseCadence;
              const nearRover = Math.random() < 0.72;
              const hx = nearRover
                ? Math.max(70, Math.min(w - 70, st.rover.x + (Math.random() - 0.5) * 200))
                : 90 + Math.random() * (w - 180);
              const hy = nearRover
                ? Math.max(70, Math.min(h - 70, st.rover.y + (Math.random() - 0.5) * 160))
                : 70 + Math.random() * (h - 140);
              const kind = loc.windMs > 2 && Math.random() < 0.55 ? 'vortex' : 'meteor';
              st.hazards.push({
                id: st.nextHazardId++,
                kind,
                x: hx,
                y: hy,
                radius: kind === 'vortex' ? 68 : 54,
                telegraph: 1.25,
                activeTimer: 0.35,
                triggered: false,
              });
              gameAudio.playWarning();
            }

            // Update telegraphed hazards
            for (let i = st.hazards.length - 1; i >= 0; i--) {
              const hz = st.hazards[i];
              if (hz.telegraph > 0) {
                hz.telegraph -= dt;
              } else {
                if (!hz.triggered) {
                  hz.triggered = true;
                  spawnBurst(
                    hz.x,
                    hz.y,
                    18,
                    hz.kind === 'vortex' ? '#fb923c' : '#f43f5e',
                    160
                  );
                  const dx = st.rover.x - hz.x;
                  const dy = st.rover.y - hz.y;
                  const dist = Math.hypot(dx, dy);
                  if (dist < hz.radius + st.rover.r * 0.7) {
                    const nx = dist > 0.1 ? dx / dist : 1;
                    const ny = dist > 0.1 ? dy / dist : 0;
                    applyDamage(18 + st.sectorIndex * 4, nx * 240, ny * 240);
                  }
                }
                hz.activeTimer -= dt;
                if (hz.activeTimer <= 0) {
                  st.hazards.splice(i, 1);
                }
              }
            }

            // Update patrol drones
            for (const d of st.drones) {
              d.phase += dt * 4;
              d.x += d.vx * dt;
              d.y += d.vy * dt;
              if (d.x < 60 || d.x > w - 60) d.vx *= -1;
              if (d.y < 60 || d.y > h - 60) d.vy *= -1;

              const dx = st.rover.x - d.x;
              const dy = st.rover.y - d.y;
              const dist = Math.hypot(dx, dy);
              if (dist < st.rover.r + d.r) {
                const nx = dist > 0.1 ? dx / dist : 1;
                const ny = dist > 0.1 ? dy / dist : 0;
                applyDamage(15, nx * 220, ny * 220);
              }
            }

            // Scan waves
            for (let i = st.scanWaves.length - 1; i >= 0; i--) {
              const sw = st.scanWaves[i];
              sw.radius += 340 * dt;
              sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
              if (sw.radius >= sw.maxRadius) {
                st.scanWaves.splice(i, 1);
              }
            }

            // Ambient dust particles driven by real wind
            if (loc.windMs > 0.5 && Math.random() < 0.35) {
              spawnBurst(
                Math.random() < 0.5 ? 8 : Math.random() * w,
                Math.random() * h,
                1,
                palette.dust,
                35 + loc.windMs * 10
              );
            }

            // Update particle pool
            for (const p of st.particles) {
              if (!p.active) continue;
              p.life -= dt;
              if (p.life <= 0) {
                p.active = false;
                continue;
              }
              p.x += p.vx * dt;
              p.y += p.vy * dt;
              p.vx *= 0.96;
              p.vy *= 0.96;
            }

            if (st.shakeTime > 0) {
              st.shakeTime = Math.max(0, st.shakeTime - dt);
            }

            // Throttled HUD sync (~12Hz)
            if (now - st.lastHudSync > 85) {
              st.lastHudSync = now;
              setHud({
                sector: st.sectorIndex + 1,
                totalSectors: st.sectors.length,
                location: loc,
                integrity: Math.round(st.integrity),
                score: Math.round(st.score),
                samplesCollected: collectedCount,
                samplesTotal: st.samples.length,
                beaconActive: allSamplesCollected,
                scannerCooldown: st.scannerCooldown,
                scannerMaxCooldown: st.scannerMaxCooldown,
                elapsedSec: Math.round(st.elapsedSec),
                hitsTaken: st.hitsTaken,
              });
            }
          }
        }

        // Render frame
        ctx.save();
        ctx.scale(dpr, dpr);

        const shakeOffset =
          st.shakeTime > 0
            ? {
                x: (Math.random() - 0.5) * 2 * st.shakeMag * (st.shakeTime / 0.28),
                y: (Math.random() - 0.5) * 2 * st.shakeMag * (st.shakeTime / 0.28),
              }
            : { x: 0, y: 0 };

        ctx.fillStyle = palette.bg;
        ctx.fillRect(0, 0, w, h);

        ctx.translate(shakeOffset.x, shakeOffset.y);

        // Telemetry grid
        ctx.strokeStyle = palette.grid;
        ctx.lineWidth = 1;
        const step = 64;
        ctx.beginPath();
        for (let gx = step; gx < w; gx += step) {
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, h);
        }
        for (let gy = step; gy < h; gy += step) {
          ctx.moveTo(0, gy);
          ctx.lineTo(w, gy);
        }
        ctx.stroke();

        // Craters / rock formations
        for (const c of st.craters) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
          ctx.fillStyle = palette.craterFill;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = palette.craterStroke;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(c.x - c.r * 0.22, c.y - c.r * 0.22, c.r * 0.62, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Relay extraction beacon
        const samplesDone =
          st.samples.length > 0 && st.samples.every((s) => s.collected);
        const beaconR = st.beacon.r + Math.sin(st.beacon.pulse) * 3;
        ctx.beginPath();
        ctx.arc(st.beacon.x, st.beacon.y, beaconR + 10, 0, Math.PI * 2);
        ctx.strokeStyle = samplesDone
          ? 'rgba(56, 189, 248, 0.7)'
          : 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 2;
        ctx.setLineDash(samplesDone ? [] : [6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(st.beacon.x, st.beacon.y, st.beacon.r * 0.65, 0, Math.PI * 2);
        ctx.fillStyle = samplesDone
          ? 'rgba(14, 165, 233, 0.35)'
          : 'rgba(100, 116, 139, 0.18)';
        ctx.fill();

        ctx.fillStyle = samplesDone ? '#7dd3fc' : '#64748b';
        ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          samplesDone ? 'BALIZA ACTIVA' : 'BALIZA (BLOQUEADA)',
          st.beacon.x,
          st.beacon.y + st.beacon.r + 22
        );

        // Mineral samples
        for (const s of st.samples) {
          if (s.collected) continue;
          const glow = 12 + Math.sin(s.pulsePhase) * 3;
          ctx.beginPath();
          ctx.arc(s.x, s.y, glow, 0, Math.PI * 2);
          ctx.fillStyle =
            s.revealedTimer > 0
              ? 'rgba(52, 211, 153, 0.25)'
              : 'rgba(250, 204, 21, 0.14)';
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(s.x, s.y - 9);
          ctx.lineTo(s.x + 8, s.y);
          ctx.lineTo(s.x, s.y + 9);
          ctx.lineTo(s.x - 8, s.y);
          ctx.closePath();
          ctx.fillStyle = s.revealedTimer > 0 ? '#34d399' : '#facc15';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#0f172a';
          ctx.stroke();

          ctx.fillStyle = '#e2e8f0';
          ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${s.oxide} ${s.pct}%`, s.x, s.y - 14);
        }

        // Telegraphed hazards
        for (const hz of st.hazards) {
          if (hz.telegraph > 0) {
            const progress = 1 - hz.telegraph / 1.25;
            ctx.beginPath();
            ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
            ctx.strokeStyle =
              hz.kind === 'vortex'
                ? 'rgba(251, 146, 60, 0.85)'
                : 'rgba(244, 63, 94, 0.85)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.beginPath();
            ctx.arc(hz.x, hz.y, hz.radius * progress, 0, Math.PI * 2);
            ctx.fillStyle =
              hz.kind === 'vortex'
                ? 'rgba(251, 146, 60, 0.2)'
                : 'rgba(244, 63, 94, 0.2)';
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
            ctx.fillStyle =
              hz.kind === 'vortex'
                ? 'rgba(251, 146, 60, 0.48)'
                : 'rgba(244, 63, 94, 0.52)';
            ctx.fill();
          }
        }

        // Patrol drones
        for (const d of st.drones) {
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r + 5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fillStyle = '#e11d48';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#fecdd3';
          ctx.stroke();
        }

        // Scan waves
        for (const sw of st.scanWaves) {
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${sw.alpha.toFixed(2)})`;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // Particles
        for (const p of st.particles) {
          if (!p.active) continue;
          ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
        }
        ctx.globalAlpha = 1;

        // Player Rover (vector geometric vehicle with squash-and-stretch + hit flash)
        const blinking =
          st.rover.invuln > 0 && Math.floor(st.rover.invuln * 16) % 2 === 1;
        if (!blinking) {
          ctx.save();
          ctx.translate(st.rover.x, st.rover.y);
          ctx.rotate(st.rover.angle);
          const sx = st.rover.squash;
          const sy = 1 / Math.max(0.7, sx);
          ctx.scale(sx, sy);

          // Rover wheels
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-13, -15, 8, 5);
          ctx.fillRect(5, -15, 8, 5);
          ctx.fillRect(-13, 10, 8, 5);
          ctx.fillRect(5, 10, 8, 5);

          // Rover chassis
          ctx.fillStyle = st.rover.hitFlash > 0 ? '#ffffff' : '#e2e8f0';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-14, -11, 28, 22, 4);
          ctx.fill();
          ctx.stroke();

          // Solar / RTG deck + directional mast
          ctx.fillStyle = st.rover.hitFlash > 0 ? '#ffffff' : '#0284c7';
          ctx.fillRect(-10, -7, 13, 14);
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(8, 0, 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }

        ctx.restore();
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [defaultLoc, saveHighScore, spawnBurst]);

  // Status label with non-hue-only differentiation
  const statusDisplay = useMemo(() => {
    if (hud.integrity >= 60) {
      return {
        label: 'ESTABLE',
        className: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/75',
        icon: CheckCircle2,
      };
    }
    if (hud.integrity >= 30) {
      return {
        label: 'ALERTA',
        className: 'text-amber-300 border-amber-500/40 bg-amber-950/75',
        icon: AlertTriangle,
      };
    }
    return {
      label: 'CRÍTICO',
      className: 'text-rose-300 border-rose-500/40 bg-rose-950/75',
      icon: ShieldAlert,
    };
  }, [hud.integrity]);

  const StatusIcon = statusDisplay.icon;
  const scannerReady = hud.scannerCooldown <= 0.05;
  const scannerPct = Math.round(
    (1 - hud.scannerCooldown / Math.max(0.1, hud.scannerMaxCooldown)) * 100
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950 text-slate-100 overflow-hidden select-none font-sans"
      role="application"
      aria-label="Misión Rover — Simulador interactivo de análogos planetarios"
    >
      {/* Active Game Playfield Canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        onPointerDown={(e) => {
          if (gameState !== 'PLAYING') return;
          const rect = e.currentTarget.getBoundingClientRect();
          engineRef.current.pointerTarget = {
            active: true,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          };
        }}
        onPointerMove={(e) => {
          if (gameState !== 'PLAYING' || !engineRef.current.pointerTarget.active) return;
          const rect = e.currentTarget.getBoundingClientRect();
          engineRef.current.pointerTarget.x = e.clientX - rect.left;
          engineRef.current.pointerTarget.y = e.clientY - rect.top;
        }}
        onPointerUp={() => {
          engineRef.current.pointerTarget.active = false;
        }}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* Unobtrusive Active Play HUD (>=85% open playfield, no backdrop-filter over canvas) */}
      {gameState !== 'TITLE_MENU' && (
        <div className="pointer-events-none absolute inset-x-0 top-0 p-4 flex items-start justify-between gap-4">
          {/* Top-Left Compact Telemetry Strip */}
          <div className="bg-slate-950/90 border border-slate-700/80 rounded-lg px-3.5 py-2.5 space-y-1.5 max-w-md">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-white truncate max-w-[240px]">
                {hud.location.body}: {hud.location.name}
              </span>
              <span className="font-mono tabular-nums text-sky-300 shrink-0">
                Sector {hud.sector}/{hud.totalSectors}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono tabular-nums">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${statusDisplay.className}`}
              >
                <StatusIcon className="w-3 h-3" />
                Integridad {hud.integrity}/100 · {statusDisplay.label}
              </span>

              <span className="text-slate-300">
                Escáner:{' '}
                <strong className={scannerReady ? 'text-sky-300' : 'text-slate-400'}>
                  {scannerReady ? 'LISTO [Espacio]' : `${scannerPct}%`}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-3 text-[10px] font-mono tabular-nums text-slate-400">
              <span>g = {hud.location.gravity.toFixed(2)} m/s²</span>
              <span>Viento = {hud.location.windMs.toFixed(1)} m/s</span>
              <span>Rad = {hud.location.radiation.toFixed(1)} µSv/h</span>
            </div>
          </div>

          {/* Top-Right Compact Score & Controls */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="bg-slate-950/90 border border-slate-700/80 rounded-lg px-3.5 py-2 text-right">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Muestras / Puntos
              </div>
              <div className="text-sm font-mono font-bold tabular-nums text-white flex items-center gap-3">
                <span className={hud.beaconActive ? 'text-sky-300' : 'text-amber-300'}>
                  {hud.samplesCollected}/{hud.samplesTotal}
                  {hud.beaconActive ? ' · Ve a la baliza' : ''}
                </span>
                <span>{hud.score.toLocaleString('es-ES')} pts</span>
              </div>
            </div>

            <button
              type="button"
              onClick={triggerScanBoost}
              disabled={!scannerReady || gameState !== 'PLAYING'}
              className="px-3 py-2.5 bg-slate-950/90 border border-slate-700/80 rounded-lg text-xs font-medium text-sky-300 hover:bg-slate-900 disabled:opacity-45 whitespace-nowrap shrink-0"
              title="Escáner / Impulso (Espacio)"
            >
              Impulso
            </button>

            <button
              type="button"
              onClick={toggleMute}
              className="p-2.5 bg-slate-950/90 border border-slate-700/80 rounded-lg text-slate-200 hover:bg-slate-900"
              aria-label={muted ? 'Activar audio' : 'Silenciar audio'}
              title="Audio (M)"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() =>
                setGameState((prev) => (prev === 'PLAYING' ? 'PAUSED' : 'PLAYING'))
              }
              className="p-2.5 bg-slate-950/90 border border-slate-700/80 rounded-lg text-slate-200 hover:bg-slate-900"
              aria-label="Pausar juego"
              title="Pausa (Esc)"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TITLE SCREEN (Full-Viewport Art Backdrop + Upper-Left Title Lockup + Mission Picker) */}
      {gameState === 'TITLE_MENU' && (
        <div className="absolute inset-0 flex flex-col justify-between">
          {/* Generated 16:9 Art Backdrop */}
          {!backdropFailed ? (
            <img
              src={BACKDROP_URL}
              alt="Vehículo de exploración planetaria recorriendo un cañón marciano"
              referrerPolicy="no-referrer"
              onError={() => setBackdropFailed(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-stone-900 to-orange-950" />
          )}

          {/* Scrim for guaranteed legibility over focal backdrop */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-950/75 to-slate-950/40" />

          {/* Top Bar on Title Screen */}
          <div className="relative z-10 px-6 pt-5 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onExitToLab}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-950/80 border border-slate-700 rounded-md hover:bg-slate-900 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver al laboratorio
            </button>

            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 bg-slate-950/80 border border-slate-700 rounded-md text-xs font-mono tabular-nums text-amber-300 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                Récord local: {bestScore.toLocaleString('es-ES')} pts
              </div>
              <button
                type="button"
                onClick={toggleMute}
                className="p-2 bg-slate-950/80 border border-slate-700 rounded-md text-slate-200 hover:bg-slate-900"
                aria-label={muted ? 'Activar audio' : 'Silenciar audio'}
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Center-Left Title Lockup + Mission Site Selector */}
          <div className="relative z-10 px-6 sm:px-10 max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-end my-auto py-4">
            <div className="lg:col-span-6 space-y-5">
              {/* Bespoke SVG Title Lockup */}
              <div>
                <svg
                  viewBox="0 0 460 105"
                  className="w-full max-w-[430px] h-auto"
                  aria-label="MISIÓN ANÁLOGO"
                >
                  <text
                    x="2"
                    y="22"
                    fill="#38bdf8"
                    fontSize="12"
                    fontWeight="700"
                    letterSpacing="4"
                    fontFamily="ui-monospace, SFMono-Regular, monospace"
                  >
                    EXPEDICIÓN COMPARATIVA · {PLAYABLE_LOCATIONS.length} SITIOS
                  </text>
                  <text
                    x="0"
                    y="66"
                    fill="#f8fafc"
                    fontSize="44"
                    fontWeight="800"
                    letterSpacing="-1"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    MISIÓN ANÁLOGO
                  </text>
                  <rect x="2" y="80" width="128" height="4" fill="#ea580c" rx="2" />
                  <rect x="136" y="80" width="44" height="4" fill="#38bdf8" rx="2" />
                </svg>
                <p className="text-sm text-slate-300 leading-relaxed max-w-md mt-1">
                  Pilota el rover por entornos calibrados de la Tierra, Marte y la
                  Luna. La gravedad real altera tu inercia, el viento desvía tu
                  trayectoria y cada muestra coincide con los óxidos del terreno.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={startNewCampaign}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-950 bg-sky-400 rounded-md hover:bg-sky-300 transition-colors whitespace-nowrap shrink-0"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Iniciar Misión
                </button>
                <button
                  type="button"
                  onClick={onExitToLab}
                  className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-200 bg-slate-900/90 border border-slate-700 rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  Abrir consola científica
                </button>
              </div>
            </div>

            {/* Clean Mission Picker Card */}
            <div className="lg:col-span-6 bg-slate-950/90 border border-slate-700 rounded-lg p-5 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-sky-400" />
                  Sitio inicial del Sector 1
                </h2>
                <div className="flex items-center gap-1">
                  {(['Todos', 'Tierra', 'Marte', 'Luna'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setBodyFilter(tab)}
                      className={`px-2 py-1 text-[11px] font-medium rounded whitespace-nowrap ${
                        bodyFilter === tab
                          ? 'bg-sky-500 text-slate-950'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <select
                value={selectedLocId}
                onChange={(e) => setSelectedLocId(e.target.value)}
                aria-label="Seleccionar sitio inicial de misión"
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100 font-medium"
              >
                {filteredLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    [{loc.body}] {loc.name} — g={loc.gravity.toFixed(2)} m/s²
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono tabular-nums">
                <div className="p-2 bg-slate-900/90 border border-slate-800 rounded">
                  <div className="text-[10px] text-slate-400">Gravedad</div>
                  <div className="text-xs font-semibold text-white">
                    {selectedLocation.gravity.toFixed(2)} m/s²
                  </div>
                </div>
                <div className="p-2 bg-slate-900/90 border border-slate-800 rounded">
                  <div className="text-[10px] text-slate-400">Temp.</div>
                  <div className="text-xs font-semibold text-white">
                    {selectedLocation.tempK.toFixed(0)} K
                  </div>
                </div>
                <div className="p-2 bg-slate-900/90 border border-slate-800 rounded">
                  <div className="text-[10px] text-slate-400">Viento</div>
                  <div className="text-xs font-semibold text-white">
                    {selectedLocation.windMs.toFixed(1)} m/s
                  </div>
                </div>
                <div className="p-2 bg-slate-900/90 border border-slate-800 rounded">
                  <div className="text-[10px] text-slate-400">Radiación</div>
                  <div className="text-xs font-semibold text-white">
                    {selectedLocation.radiation.toFixed(1)} µSv/h
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 truncate">
                Fuente: {selectedLocation.sourceLabel} ({selectedLocation.lat.toFixed(2)}°,{' '}
                {selectedLocation.lon.toFixed(2)}°)
              </div>
            </div>
          </div>

          {/* Flat Bottom Control-Hint Strip */}
          <div className="relative z-10 px-6 pb-5 flex items-center justify-between text-xs font-mono text-slate-300">
            <span>
              WASD / Flechas Mover · Espacio Escáner / Impulso · M Audio · Esc Pausa
            </span>
            <span className="hidden sm:inline text-slate-400">
              3 sectores · Recolecta muestras y alcanza la baliza
            </span>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {gameState === 'PAUSED' && (
        <div className="absolute inset-0 z-20 bg-slate-950/75 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Misión en pausa</h2>
            <p className="text-xs text-slate-300">
              Sector {hud.sector} de {hud.totalSectors}: {hud.location.name}
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => setGameState('PLAYING')}
                className="w-full py-2.5 px-4 text-xs font-semibold text-slate-950 bg-sky-400 rounded-md hover:bg-sky-300"
              >
                Continuar misión
              </button>
              <button
                type="button"
                onClick={startNewCampaign}
                className="w-full py-2.5 px-4 text-xs font-medium text-slate-200 bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700"
              >
                Jugar de nuevo
              </button>
              <button
                type="button"
                onClick={() => setGameState('TITLE_MENU')}
                className="w-full py-2.5 px-4 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700 rounded-md hover:bg-slate-800"
              >
                Cambiar sitio de misión
              </button>
              <button
                type="button"
                onClick={onExitToLab}
                className="w-full py-2 px-4 text-xs font-medium text-slate-400 hover:text-white"
              >
                Volver al laboratorio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROUND SUMMARY MODAL */}
      {gameState === 'ROUND_SUMMARY' && (
        <div className="absolute inset-0 z-20 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-white">
                Sector {hud.sector} completado
              </h2>
              <span className="text-xs font-mono tabular-nums text-sky-300">
                {hud.score.toLocaleString('es-ES')} pts
              </span>
            </div>

            <p className="text-xs text-slate-300">
              Enlace establecido en <strong>{hud.location.name}</strong> ({hud.location.body}).
              Integridad restante del rover: {hud.integrity}/100 (+25 de reparación en
              tránsito al siguiente sector).
            </p>

            {/* Optional Google Maps Grounding briefing when finishing an Earth analog sector */}
            {hud.location.body === 'Tierra' && (
              <div className="pt-1 space-y-2 border-t border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-sky-400" />
                    Briefing real de campo (Google Maps)
                  </span>
                  <button
                    type="button"
                    onClick={fetchEarthSectorBriefing}
                    disabled={mapsLoading}
                    className="px-3 py-1 text-[11px] font-medium bg-slate-800 border border-slate-600 text-sky-300 rounded hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {mapsLoading ? 'Consultando...' : 'Cargar contexto Maps'}
                  </button>
                </div>

                {mapsError && (
                  <p className="text-[11px] text-rose-300">{mapsError}</p>
                )}

                {mapsBriefing && (
                  <div className="max-h-40 overflow-y-auto bg-slate-950 border border-slate-800 rounded p-3 space-y-2 text-[11px] text-slate-300">
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {mapsBriefing.respuestaMarkdown}
                    </p>
                    {mapsBriefing.lugares.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {mapsBriefing.lugares.map((lugar, i) => (
                          <a
                            key={i}
                            href={lugar.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                          >
                            <span>{lugar.title}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onExitToLab}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white"
              >
                Volver al laboratorio
              </button>
              <button
                type="button"
                onClick={advanceToNextSector}
                className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-sky-400 rounded-md hover:bg-sky-300 whitespace-nowrap shrink-0"
              >
                Siguiente sector ({hud.sector + 1}/{hud.totalSectors})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY / GAME OVER MODAL */}
      {(gameState === 'VICTORY' || gameState === 'GAME_OVER') && (
        <div className="absolute inset-0 z-20 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">
              {gameState === 'VICTORY'
                ? 'Expedición completada'
                : 'Pérdida de integridad del rover'}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {gameState === 'VICTORY'
                ? 'Has completado los tres sectores comparativos y transmitido todas las muestras mineralógicas por la red orbital.'
                : `El chasis del rover superó el umbral de daños en ${hud.location.name} (${hud.location.body}).`}
            </p>

            <div className="grid grid-cols-3 gap-2 text-center font-mono tabular-nums pt-1">
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                <div className="text-[10px] text-slate-400">Puntuación</div>
                <div className="text-sm font-bold text-sky-300">
                  {hud.score.toLocaleString('es-ES')}
                </div>
              </div>
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                <div className="text-[10px] text-slate-400">Tiempo</div>
                <div className="text-sm font-bold text-white">{hud.elapsedSec} s</div>
              </div>
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                <div className="text-[10px] text-slate-400">Récord</div>
                <div className="text-sm font-bold text-amber-300">
                  {bestScore.toLocaleString('es-ES')}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onExitToLab}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white"
              >
                Volver al laboratorio
              </button>
              <button
                type="button"
                onClick={() => setGameState('TITLE_MENU')}
                className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700"
              >
                Menú de misión
              </button>
              <button
                type="button"
                onClick={startNewCampaign}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-sky-400 rounded-md hover:bg-sky-300 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Jugar de nuevo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
