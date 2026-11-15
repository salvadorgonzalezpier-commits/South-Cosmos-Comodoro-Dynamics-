import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SitioAmbiental } from './analogo';
import {
  ComponentPinDiagnostic,
  HardwareSpec,
  MaterialTipo,
  RecubrimientoTipo,
  WearVisualMode,
  ZonaDespliegue,
} from './wearEngine';

export type CameraPresetId = 'orbital' | 'frontal' | 'lateral' | 'superior';

export interface Wear3DSceneParams {
  sitio: SitioAmbiental;
  hardware: HardwareSpec;
  recubrimiento: RecubrimientoTipo;
  zona: ZonaDespliegue;
  dias: number;
  visualMode: WearVisualMode;
  showPins: boolean;
  showDustEffect: boolean;
  selectedPinId: string | null;
  pinDiagnostics: ComponentPinDiagnostic[];
  autoRotate: boolean;
}

const _vec3 = new THREE.Vector3();
const _targetCam = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();

function detectSoftwareGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function getBodyPalette(sitio: SitioAmbiental) {
  const n = sitio.nombre.toLowerCase();
  if (n.includes('luna') || sitio.id === 'luna-mare') {
    return {
      bgHex: 0x07090e,
      fogHex: 0x090d16,
      groundHex: 0x5c6473,
      dustCss: 'rgba(185, 195, 210, 0.72)',
      rockHex: 0x3b4252,
      dustHex: 0x94a3b8,
      sunHex: 0xf8fafc,
    };
  }
  if (n.includes('marte') || sitio.id === 'marte-gale') {
    return {
      bgHex: 0x0b080a,
      fogHex: 0x160f0d,
      groundHex: 0x8b462d,
      dustCss: 'rgba(218, 118, 68, 0.78)',
      rockHex: 0x5c2c1c,
      dustHex: 0xd97745,
      sunHex: 0xffedd5,
    };
  }
  return {
    bgHex: 0x070b12,
    fogHex: 0x0b1220,
    groundHex: 0x8d6e4c,
    dustCss: 'rgba(214, 178, 128, 0.72)',
    rockHex: 0x5e4933,
    dustHex: 0xd6b280,
    sunHex: 0xfff7ed,
  };
}

function getBaseAlloyAppearance(matId: MaterialTipo, coat: RecubrimientoTipo) {
  let color = 0xcbd5e1;
  let metalness = 0.85;
  let roughness = 0.28;

  if (matId === 'al7075') {
    color = 0xdbe3ed;
    metalness = 0.88;
    roughness = 0.24;
  } else if (matId === 'ti6al4v') {
    color = 0x9aa5b5;
    metalness = 0.92;
    roughness = 0.26;
  } else if (matId === 'vectran') {
    color = 0xe7dfd1;
    metalness = 0.08;
    roughness = 0.74;
  } else if (matId === 'basalto_cfrp') {
    color = 0x374151;
    metalness = 0.22;
    roughness = 0.48;
  } else if (matId === 'inox316l') {
    color = 0xc4ccd6;
    metalness = 0.96;
    roughness = 0.18;
  }

  if (coat === 'anodizado_duro') {
    color = 0x475569;
    roughness = Math.min(0.65, roughness + 0.14);
  } else if (coat === 'hbn_ceramico') {
    color = 0xd7e3ec;
    metalness = Math.max(0.15, metalness - 0.35);
    roughness = 0.32;
  } else if (coat === 'ptfe_poliimida') {
    color = 0xd99b26;
    metalness = 0.45;
    roughness = 0.36;
  } else if (coat === 'pintura_z93') {
    color = 0xf1f5f9;
    metalness = 0.05;
    roughness = 0.56;
  }

  return { color, metalness, roughness };
}

function wearHeatColor(pct: number, mode: WearVisualMode): number {
  const t = Math.max(0, Math.min(1, pct / 85));
  if (mode === 'termico') {
    if (t < 0.5) {
      _colorA.setHex(0x06b6d4);
      _colorB.setHex(0xf59e0b);
      return _colorA.lerp(_colorB, t * 2).getHex();
    }
    _colorA.setHex(0xf59e0b);
    _colorB.setHex(0xef4444);
    return _colorA.lerp(_colorB, (t - 0.5) * 2).getHex();
  }
  if (mode === 'mecanico') {
    _colorA.setHex(0x38bdf8);
    _colorB.setHex(0xf97316);
    return _colorA.lerp(_colorB, t).getHex();
  }
  if (mode === 'radiacion') {
    _colorA.setHex(0x22d3ee);
    _colorB.setHex(0xa855f7);
    return _colorA.lerp(_colorB, t).getHex();
  }
  return 0xcbd5e1;
}

export class Wear3DViewportController {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private isSoftwareGl: boolean;
  private maxAniso: number;

  private envTexture: THREE.Texture;
  private terrainGroup: THREE.Group;
  private hardwareGroup: THREE.Group;
  private pinsGroup: THREE.Group;
  private dustPoints: THREE.Points | null = null;
  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

  private wearTexture: THREE.CanvasTexture;
  private wearCanvas: HTMLCanvasElement;
  private partMaterials: Map<string, THREE.MeshPhysicalMaterial[]> = new Map();
  private pinMeshes: Map<string, { core: THREE.Mesh; halo: THREE.Mesh; baseY: number }> =
    new Map();

  private currentModelKey = '';
  private currentTerrainKey = '';
  private currentTextureKey = '';
  private params: Wear3DSceneParams;
  private onSelectPin: (pinId: string) => void;
  private onContextLostState: (lost: boolean) => void;

  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private frameId = 0;
  private disposed = false;

  private camTransitionActive = false;
  private desiredCamPos = new THREE.Vector3(3.4, 2.2, 3.6);
  private desiredTarget = new THREE.Vector3(0, 0.6, 0);

  constructor(
    container: HTMLElement,
    initialParams: Wear3DSceneParams,
    onSelectPin: (pinId: string) => void,
    onContextLostState: (lost: boolean) => void
  ) {
    this.container = container;
    this.params = initialParams;
    this.onSelectPin = onSelectPin;
    this.onContextLostState = onContextLostState;
    this.isSoftwareGl = detectSoftwareGl();

    const width = Math.max(280, container.clientWidth || 640);
    const height = Math.max(280, container.clientHeight || 460);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy() || 1);

    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 60);
    this.camera.position.copy(this.desiredCamPos);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 8.5;
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.target.copy(this.desiredTarget);
    this.controls.autoRotate = initialParams.autoRotate && !this.isSoftwareGl;
    this.controls.autoRotateSpeed = 0.85;

    this.controls.addEventListener('start', () => {
      this.camTransitionActive = false;
    });

    // Iluminación 3 puntos (Key cálido + Hemisphere cielo/suelo + Rim trasero)
    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x332419, 0.72);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff4e0, 2.35);
    this.keyLight.position.set(4.5, 6.2, 3.8);
    if (!this.isSoftwareGl) {
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(1024, 1024);
      this.keyLight.shadow.camera.left = -3.2;
      this.keyLight.shadow.camera.right = 3.2;
      this.keyLight.shadow.camera.top = 3.2;
      this.keyLight.shadow.camera.bottom = -3.2;
      this.keyLight.shadow.bias = -0.0005;
      this.keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    this.rimLight.position.set(-4.0, 2.8, -4.2);
    this.scene.add(this.rimLight);

    this.terrainGroup = new THREE.Group();
    this.hardwareGroup = new THREE.Group();
    this.pinsGroup = new THREE.Group();
    this.scene.add(this.terrainGroup);
    this.scene.add(this.hardwareGroup);
    this.scene.add(this.pinsGroup);

    // Textura procedimental dinámica para polvo electrostático + microfisuras
    this.wearCanvas = document.createElement('canvas');
    this.wearCanvas.width = 256;
    this.wearCanvas.height = 256;
    this.wearTexture = new THREE.CanvasTexture(this.wearCanvas);
    this.wearTexture.colorSpace = THREE.SRGBColorSpace;
    this.wearTexture.wrapS = THREE.RepeatWrapping;
    this.wearTexture.wrapT = THREE.RepeatWrapping;
    this.wearTexture.anisotropy = this.maxAniso;

    this.bindEvents();
    this.syncParams(initialParams);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.tick();
  }

  private bindEvents() {
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.onContextLostState(true);
  };

  private handleContextRestored = () => {
    this.onContextLostState(false);
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.params.showPins) {
      this.renderer.domElement.style.cursor = 'grab';
      return;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.layers.set(1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pinsGroup.children, true);
    this.renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
  };

  private handlePointerUp = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.layers.set(1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const pinHits = this.raycaster.intersectObjects(this.pinsGroup.children, true);
    if (pinHits.length > 0) {
      const cid = pinHits[0].object.userData?.componentId;
      if (typeof cid === 'string') {
        this.focusOnComponent(cid);
        this.onSelectPin(cid);
        return;
      }
    }

    // Permitir clic directo sobre piezas 3D del equipo también
    this.raycaster.layers.set(0);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hwHits = this.raycaster.intersectObjects(this.hardwareGroup.children, true);
    if (hwHits.length > 0) {
      const cid = hwHits[0].object.userData?.componentId;
      if (typeof cid === 'string') {
        this.onSelectPin(cid);
      }
    }
  };

  public resize() {
    if (this.disposed) return;
    const width = Math.max(260, this.container.clientWidth || 640);
    const height = Math.max(260, this.container.clientHeight || 460);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public setCameraPreset(preset: CameraPresetId) {
    if (preset === 'orbital') {
      this.desiredCamPos.set(3.4, 2.2, 3.6);
      this.desiredTarget.set(0, 0.65, 0);
    } else if (preset === 'frontal') {
      this.desiredCamPos.set(0, 1.35, 4.1);
      this.desiredTarget.set(0, 0.65, 0);
    } else if (preset === 'lateral') {
      this.desiredCamPos.set(4.2, 1.25, 0.1);
      this.desiredTarget.set(0, 0.65, 0);
    } else {
      this.desiredCamPos.set(0.01, 4.9, 1.6);
      this.desiredTarget.set(0, 0.4, 0);
    }
    this.camTransitionActive = true;
  }

  public focusOnComponent(pinId: string) {
    const diag = this.params.pinDiagnostics.find((p) => p.id === pinId);
    if (!diag) return;
    const [ax, ay, az] = diag.anchor;
    this.desiredTarget.set(ax, ay, az);
    const signX = ax >= 0 ? 1 : -1;
    const signZ = az >= 0 ? 1 : -1;
    this.desiredCamPos.set(
      ax + signX * 1.9 + 0.5,
      Math.max(0.85, ay + 1.05),
      az + signZ * 1.9 + 0.6
    );
    this.camTransitionActive = true;
  }

  public captureDataUrl(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  private clearGroup(group: THREE.Group) {
    const geoms = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints) {
        const m = obj as THREE.Mesh;
        if (m.geometry) geoms.add(m.geometry);
        if (Array.isArray(m.material)) m.material.forEach((x) => mats.add(x));
        else if (m.material) mats.add(m.material);
      }
    });
    group.clear();
    geoms.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  }

  private rebuildTerrain() {
    this.clearGroup(this.terrainGroup);
    const pal = getBodyPalette(this.params.sitio);
    this.scene.background = new THREE.Color(pal.bgHex);
    this.scene.fog = new THREE.FogExp2(pal.fogHex, 0.068);
    this.keyLight.color.setHex(pal.sunHex);

    // Base rocosa escalonada con pendiente según la zona elegida
    const slopeRad =
      this.params.zona.id === 'ladera'
        ? 0.16
        : this.params.zona.id === 'cresta_solar'
          ? 0.08
          : 0;

    const baseGeo = new THREE.CylinderGeometry(3.5, 3.85, 0.28, 48);
    const baseMat = new THREE.MeshStandardMaterial({
      color: pal.groundHex,
      roughness: 0.92,
      metalness: 0.04,
    });
    const baseDisk = new THREE.Mesh(baseGeo, baseMat);
    baseDisk.position.y = -0.14;
    baseDisk.receiveShadow = true;
    this.terrainGroup.add(baseDisk);

    // Anillo técnico sutil perimetral (evita Z-fighting con polygonOffset)
    const ringGeo = new THREE.RingGeometry(3.25, 3.31, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.006;
    this.terrainGroup.add(ring);

    // Rocas instanciadas periféricas (InstancedMesh para alto rendimiento)
    const rockCount = 26;
    const rockGeo = new THREE.DodecahedronGeometry(0.14, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: pal.rockHex,
      roughness: 0.9,
      metalness: 0.05,
    });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rocks.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < rockCount; i++) {
      const ang = (i / rockCount) * Math.PI * 2 + (i % 3) * 0.21;
      const dist = 1.95 + ((i * 37) % 100) / 85;
      const sx = 0.65 + ((i * 19) % 10) * 0.08;
      const sy = 0.45 + ((i * 13) % 8) * 0.06;
      dummy.position.set(
        Math.cos(ang) * dist,
        sy * 0.04 + Math.cos(ang) * slopeRad * 0.4,
        Math.sin(ang) * dist
      );
      dummy.rotation.set(i * 0.5, i * 1.1, i * 0.3);
      dummy.scale.set(sx, sy, sx * 0.9);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    rocks.computeBoundingSphere();
    this.terrainGroup.add(rocks);

    // Partículas de polvo en suspensión
    const pCount = 120;
    const pos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pos[i * 3] = (((i * 73) % 100) / 100 - 0.5) * 6.0;
      pos[i * 3 + 1] = 0.08 + ((i * 29) % 100) / 48;
      pos[i * 3 + 2] = (((i * 47) % 100) / 100 - 0.5) * 6.0;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({
      color: pal.dustHex,
      size: 0.038,
      transparent: true,
      opacity: 0.58,
    });
    this.dustPoints = new THREE.Points(pGeo, pMat);
    this.terrainGroup.add(this.dustPoints);
  }

  private registerPartMesh(
    componentId: string,
    mesh: THREE.Mesh,
    mat: THREE.MeshPhysicalMaterial
  ) {
    mesh.userData.componentId = componentId;
    mesh.castShadow = !this.isSoftwareGl;
    mesh.receiveShadow = true;
    const arr = this.partMaterials.get(componentId) ?? [];
    arr.push(mat);
    this.partMaterials.set(componentId, arr);
  }

  private makePhysicalMat(color: number, metalness: number, roughness: number) {
    return new THREE.MeshPhysicalMaterial({
      color,
      metalness,
      roughness,
      map: this.wearTexture,
      clearcoat: 0.12,
      clearcoatRoughness: 0.35,
    });
  }

  private rebuildHardwareModel() {
    this.clearGroup(this.hardwareGroup);
    this.partMaterials.clear();

    const hw = this.params.hardware;

    if (hw.tipo === 'custom' && hw.customModel?.vertices?.length && hw.customModel.faces?.length) {
      const verts = hw.customModel.vertices;
      const faces = hw.customModel.faces;
      const posArr = new Float32Array(faces.length * 9);
      let minY = Infinity;
      for (const [, y] of verts) {
        if (y < minY) minY = y;
      }
      const liftY = Number.isFinite(minY) ? -minY : 0;

      for (let i = 0; i < faces.length; i++) {
        const [ia, ib, ic] = faces[i];
        const a = verts[ia] ?? [0, 0, 0];
        const b = verts[ib] ?? [0, 0, 0];
        const c = verts[ic] ?? [0, 0, 0];
        const o = i * 9;
        posArr[o] = a[0];
        posArr[o + 1] = a[1] + liftY;
        posArr[o + 2] = a[2];
        posArr[o + 3] = b[0];
        posArr[o + 4] = b[1] + liftY;
        posArr[o + 5] = b[2];
        posArr[o + 6] = c[0];
        posArr[o + 7] = c[1] + liftY;
        posArr[o + 8] = c[2];
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      geo.computeVertexNormals();
      const mat = this.makePhysicalMat(0xcbd5e1, 0.72, 0.35);
      mat.side = THREE.DoubleSide;
      const customMesh = new THREE.Mesh(geo, mat);
      this.registerPartMesh('estructura_central', customMesh, mat);
      this.hardwareGroup.add(customMesh);
    } else if (hw.tipo === 'custom' && hw.customModel?.poligonos2d?.length) {
      hw.customModel.poligonos2d.forEach((poly, idx) => {
        if (poly.points.length < 3) return;
        const shape = new THREE.Shape();
        poly.points.forEach(([px, py], i) => {
          const sx = px * 1.1;
          const sy = -py * 1.1;
          if (i === 0) shape.moveTo(sx, sy);
          else shape.lineTo(sx, sy);
        });
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: 0.65 - idx * 0.08,
          bevelEnabled: true,
          bevelThickness: 0.03,
          bevelSize: 0.03,
          bevelSegments: 2,
        });
        geo.translate(0, 0, -(0.65 - idx * 0.08) / 2);
        const mat = this.makePhysicalMat(0xcbd5e1, 0.6, 0.4);
        const m = new THREE.Mesh(geo, mat);
        this.registerPartMesh(idx === 0 ? 'estructura_central' : 'carcasa_superior', m, mat);
        this.hardwareGroup.add(m);
      });
    } else if (hw.tipo === 'traje') {
      // Traje EVA compuesto (10+ partes)
      const matBotas = this.makePhysicalMat(0x64748b, 0.2, 0.85);
      const matJuntas = this.makePhysicalMat(0x94a3b8, 0.85, 0.25);
      const matTorso = this.makePhysicalMat(0xe7dfd1, 0.1, 0.72);
      const matVisor = this.makePhysicalMat(0xd99b26, 0.94, 0.14);
      const matPlss = this.makePhysicalMat(0xf1f5f9, 0.25, 0.42);

      [-0.22, 0.22].forEach((side) => {
        const bota = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.34), matBotas);
        bota.position.set(side, 0.09, 0.05);
        this.registerPartMesh('botas', bota, matBotas);
        this.hardwareGroup.add(bota);

        const pierna = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.68, 16), matTorso);
        pierna.position.set(side, 0.52, 0);
        this.registerPartMesh('juntas_traje', pierna, matTorso);
        this.hardwareGroup.add(pierna);

        const rodilla = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.024, 10, 20), matJuntas);
        rodilla.rotation.x = Math.PI / 2;
        rodilla.position.set(side, 0.54, 0);
        this.registerPartMesh('juntas_traje', rodilla, matJuntas);
        this.hardwareGroup.add(rodilla);

        const brazo = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.44, 6, 12), matTorso);
        brazo.position.set(side * 1.72, 1.14, 0.06);
        brazo.rotation.z = side > 0 ? -0.22 : 0.22;
        brazo.rotation.x = -0.22;
        this.registerPartMesh('juntas_traje', brazo, matTorso);
        this.hardwareGroup.add(brazo);

        const anilloHombro = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 10, 20), matJuntas);
        anilloHombro.rotation.y = Math.PI / 2;
        anilloHombro.position.set(side * 1.48, 1.35, 0);
        this.registerPartMesh('juntas_traje', anilloHombro, matJuntas);
        this.hardwareGroup.add(anilloHombro);
      });

      const cadera = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.2, 18), matJuntas);
      cadera.position.set(0, 0.92, 0);
      this.registerPartMesh('torso', cadera, matJuntas);
      this.hardwareGroup.add(cadera);

      const pecho = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.52, 0.36), matTorso);
      pecho.position.set(0, 1.24, 0.02);
      this.registerPartMesh('torso', pecho, matTorso);
      this.hardwareGroup.add(pecho);

      const dcm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.08), matJuntas);
      dcm.position.set(0, 1.24, 0.22);
      this.registerPartMesh('torso', dcm, matJuntas);
      this.hardwareGroup.add(dcm);

      const casco = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), matPlss);
      casco.position.set(0, 1.72, 0.02);
      this.registerPartMesh('visor', casco, matPlss);
      this.hardwareGroup.add(casco);

      const visor = new THREE.Mesh(
        new THREE.SphereGeometry(0.205, 24, 16, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.22, Math.PI * 0.52),
        matVisor
      );
      visor.position.set(0, 1.72, 0.055);
      visor.rotation.y = Math.PI / 2;
      this.registerPartMesh('visor', visor, matVisor);
      this.hardwareGroup.add(visor);

      const plss = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.64, 0.26), matPlss);
      plss.position.set(0, 1.31, -0.28);
      this.registerPartMesh('plss', plss, matPlss);
      this.hardwareGroup.add(plss);

      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.35, 10), matJuntas);
      ant.position.set(0.18, 1.78, -0.32);
      this.registerPartMesh('plss', ant, matJuntas);
      this.hardwareGroup.add(ant);
    } else if (hw.tipo === 'base') {
      // Base Permanente compuesta (domo + esclusa + bermas + arreglo solar + comunicaciones)
      const matBerma = this.makePhysicalMat(0x52525b, 0.15, 0.85);
      const matDomo = this.makePhysicalMat(0xe2e8f0, 0.42, 0.44);
      const matEsclusa = this.makePhysicalMat(0x94a3b8, 0.82, 0.28);
      const matPanel = this.makePhysicalMat(0x1d4ed8, 0.65, 0.22);
      const matComms = this.makePhysicalMat(0xcbd5e1, 0.88, 0.24);

      const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.56, 0.24, 24), matBerma);
      collar.position.set(0, 0.12, 0);
      this.registerPartMesh('cimentacion', collar, matBerma);
      this.hardwareGroup.add(collar);

      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.28), matBerma);
        pad.position.set(Math.cos(a) * 1.48, 0.08, Math.sin(a) * 1.48);
        pad.rotation.y = -a;
        this.registerPartMesh('cimentacion', pad, matBerma);
        this.hardwareGroup.add(pad);
      }

      const domo = new THREE.Mesh(
        new THREE.SphereGeometry(1.22, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
        matDomo
      );
      domo.position.set(0, 0.22, 0);
      this.registerPartMesh('domo', domo, matDomo);
      this.hardwareGroup.add(domo);

      // Anillo escudo superior
      const cupulaTop = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.12, 18), matEsclusa);
      cupulaTop.position.set(0, 1.38, 0);
      this.registerPartMesh('domo', cupulaTop, matEsclusa);
      this.hardwareGroup.add(cupulaTop);

      // Esclusa presurizada frontal
      const tunel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.78, 18), matEsclusa);
      tunel.rotation.x = Math.PI / 2;
      tunel.position.set(0, 0.42, 1.25);
      this.registerPartMesh('esclusa', tunel, matEsclusa);
      this.hardwareGroup.add(tunel);

      const escotilla = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.1), matComms);
      escotilla.position.set(0, 0.42, 1.65);
      this.registerPartMesh('esclusa', escotilla, matComms);
      this.hardwareGroup.add(escotilla);

      // Arreglo solar y radiadores laterales
      [-1.72, 1.72].forEach((side) => {
        const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.95, 10), matEsclusa);
        poste.position.set(side * 0.86, 0.48, -0.35);
        this.registerPartMesh('paneles_base', poste, matEsclusa);
        this.hardwareGroup.add(poste);

        const ala = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.04, 0.55), matPanel);
        ala.position.set(side * 0.92, 0.95, -0.35);
        ala.rotation.x = 0.28;
        this.registerPartMesh('paneles_base', ala, matPanel);
        this.hardwareGroup.add(ala);
      });

      // Torre de comunicaciones
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.05, 10), matComms);
      mast.position.set(0.45, 1.15, -0.65);
      this.registerPartMesh('comunicaciones', mast, matComms);
      this.hardwareGroup.add(mast);

      const plato = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.12, 18, 1, true), matComms);
      plato.position.set(0.45, 1.68, -0.62);
      plato.rotation.x = Math.PI * 0.35;
      this.registerPartMesh('comunicaciones', plato, matComms);
      this.hardwareGroup.add(plato);
    } else {
      // Rover 6x6 Explorador (12+ partes detalladas)
      const matChasis = this.makePhysicalMat(0xd4a437, 0.72, 0.3);
      const matRuedas = this.makePhysicalMat(0x475569, 0.88, 0.32);
      const matJuntas = this.makePhysicalMat(0xcbd5e1, 0.9, 0.24);
      const matPanel = this.makePhysicalMat(0x1e3a8a, 0.55, 0.22);
      const matMastil = this.makePhysicalMat(0xf1f5f9, 0.45, 0.35);

      const chasis = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.38, 1.68), matChasis);
      chasis.position.set(0, 0.66, 0);
      this.registerPartMesh('chasis', chasis, matChasis);
      this.hardwareGroup.add(chasis);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.07, 1.56), matPanel);
      deck.position.set(0, 0.88, -0.05);
      this.registerPartMesh('paneles', deck, matPanel);
      this.hardwareGroup.add(deck);

      // MMRTG trasero con aletas
      const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.56, 12), matRuedas);
      rtg.rotation.x = Math.PI * 0.35;
      rtg.position.set(0, 0.74, -0.98);
      this.registerPartMesh('paneles', rtg, matRuedas);
      this.hardwareGroup.add(rtg);

      // 6 ruedas + ejes + puntales rocker-bogie
      const zWheels = [-0.82, 0.02, 0.86];
      [-0.88, 0.88].forEach((sideX) => {
        const barra = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.68), matJuntas);
        barra.position.set(sideX * 0.82, 0.48, 0);
        this.registerPartMesh('juntas', barra, matJuntas);
        this.hardwareGroup.add(barra);

        zWheels.forEach((wz) => {
          const rueda = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 20), matRuedas);
          rueda.rotation.z = Math.PI / 2;
          rueda.position.set(sideX, 0.24, wz);
          this.registerPartMesh('ruedas', rueda, matRuedas);
          this.hardwareGroup.add(rueda);

          const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 12), matJuntas);
          hub.rotation.z = Math.PI / 2;
          hub.position.set(sideX, 0.24, wz);
          this.registerPartMesh('ruedas', hub, matJuntas);
          this.hardwareGroup.add(hub);

          const puntal = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.34, 8), matJuntas);
          puntal.position.set(sideX * 0.86, 0.36, wz);
          this.registerPartMesh('juntas', puntal, matJuntas);
          this.hardwareGroup.add(puntal);
        });
      });

      // Mástil óptico + cabeza estéreo
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.68, 12), matMastil);
      mast.position.set(0.36, 1.18, 0.45);
      this.registerPartMesh('mastil', mast, matMastil);
      this.hardwareGroup.add(mast);

      const cabeza = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.2), matMastil);
      cabeza.position.set(0.36, 1.54, 0.48);
      this.registerPartMesh('mastil', cabeza, matMastil);
      this.hardwareGroup.add(cabeza);

      const plato = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.09, 18, 1, true), matJuntas);
      plato.position.set(-0.34, 1.12, -0.45);
      plato.rotation.x = -Math.PI * 0.25;
      this.registerPartMesh('mastil', plato, matJuntas);
      this.hardwareGroup.add(plato);

      // Brazo muestreador frontal
      const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.65), matJuntas);
      brazo.position.set(-0.18, 0.56, 1.05);
      brazo.rotation.x = 0.25;
      this.registerPartMesh('juntas', brazo, matJuntas);
      this.hardwareGroup.add(brazo);
    }
  }

  private rebuildPins() {
    this.clearGroup(this.pinsGroup);
    this.pinMeshes.clear();
    if (!this.params.showPins) return;

    this.params.pinDiagnostics.forEach((pin) => {
      const statusHex =
        pin.estado === 'Crítico' ? 0xef4444 : pin.estado === 'Vigilancia' ? 0xf59e0b : 0x06b6d4;
      const coreGeo = new THREE.SphereGeometry(0.075, 14, 12);
      const coreMat = new THREE.MeshBasicMaterial({ color: statusHex });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.set(pin.anchor[0], pin.anchor[1] + 0.12, pin.anchor[2]);
      core.layers.set(1);
      core.userData.componentId = pin.id;

      const haloGeo = new THREE.RingGeometry(0.1, 0.135, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color: statusHex,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(core.position);
      halo.layers.set(1);
      halo.userData.componentId = pin.id;

      this.pinsGroup.add(core);
      this.pinsGroup.add(halo);
      this.pinMeshes.set(pin.id, { core, halo, baseY: core.position.y });
    });
  }

  private refreshWearTexture() {
    const texKey = `${this.params.sitio.id}|${Math.round(this.params.dias / 10)}|${this.params.showDustEffect}|${this.params.visualMode}`;
    if (texKey === this.currentTextureKey) return;
    this.currentTextureKey = texKey;

    const ctx = this.wearCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);

    if (this.params.visualMode === 'fisico' && this.params.showDustEffect) {
      const pal = getBodyPalette(this.params.sitio);
      const dustFraction = Math.min(1, this.params.dias / 420);
      const specks = Math.round(120 + dustFraction * 900);

      // Motas de regolito electrostático
      ctx.fillStyle = pal.dustCss;
      for (let i = 0; i < specks; i++) {
        const x = ((i * 137 + 19) % 256);
        const y = ((i * 89 + 43) % 256);
        const r = 0.7 + ((i % 4) * 0.55) * (0.5 + dustFraction);
        ctx.fillRect(x, y, r, r);
      }

      // Microfisuras sutiles a partir de 90 días
      if (this.params.dias >= 90) {
        ctx.strokeStyle = `rgba(15, 23, 42, ${0.15 + dustFraction * 0.35})`;
        ctx.lineWidth = 1;
        const nCracks = Math.round(6 + dustFraction * 26);
        for (let i = 0; i < nCracks; i++) {
          const sx = (i * 53 + 11) % 240;
          const sy = (i * 71 + 29) % 240;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + ((i % 3) - 1) * 14 + 9, sy + ((i % 2) ? 10 : -8));
          ctx.lineTo(sx + 16, sy + 14);
          ctx.stroke();
        }
      }
    }

    this.wearTexture.needsUpdate = true;
  }

  private applyMaterialAppearance() {
    const baseApp = getBaseAlloyAppearance(
      this.params.hardware.material,
      this.params.recubrimiento
    );
    const dustProgress = this.params.showDustEffect
      ? Math.min(0.48, (this.params.dias / 600) * 0.48)
      : 0;

    this.partMaterials.forEach((mats, cid) => {
      const diag = this.params.pinDiagnostics.find((p) => p.id === cid);
      const isSelected = this.params.selectedPinId === cid;

      mats.forEach((m) => {
        if (this.params.visualMode === 'fisico') {
          m.color.setHex(baseApp.color);
          m.metalness = Math.max(0.05, baseApp.metalness - dustProgress * 0.75);
          m.roughness = Math.min(0.95, baseApp.roughness + dustProgress * 0.9);
          m.clearcoat = isSelected ? 0.65 : Math.max(0, 0.25 - dustProgress * 0.25);
        } else {
          const metric =
            this.params.visualMode === 'termico'
              ? diag?.termicaPct ?? 35
              : this.params.visualMode === 'mecanico'
                ? diag?.abrasionPct ?? 35
                : diag?.radiacionPct ?? 35;
          m.color.setHex(wearHeatColor(metric, this.params.visualMode));
          m.metalness = 0.22;
          m.roughness = 0.45;
        }
        m.emissive.setHex(isSelected ? 0x06b6d4 : 0x000000);
        m.emissiveIntensity = isSelected ? 0.35 : 0;
        m.needsUpdate = true;
      });
    });

    // Destacar pin activo
    this.pinMeshes.forEach(({ core, halo }, id) => {
      const active = this.params.selectedPinId === id;
      core.scale.setScalar(active ? 1.45 : 1.0);
      halo.scale.setScalar(active ? 1.55 : 1.0);
    });
  }

  public syncParams(next: Wear3DSceneParams) {
    this.params = next;
    this.controls.autoRotate = next.autoRotate && !this.isSoftwareGl;

    const terrainKey = `${next.sitio.id}|${next.zona.id}`;
    if (terrainKey !== this.currentTerrainKey) {
      this.currentTerrainKey = terrainKey;
      this.rebuildTerrain();
    }

    const modelKey = `${next.hardware.id}|${next.hardware.tipo}|${next.hardware.customModel?.fileName ?? ''}`;
    if (modelKey !== this.currentModelKey) {
      this.currentModelKey = modelKey;
      this.rebuildHardwareModel();
    }

    this.rebuildPins();
    this.refreshWearTexture();
    this.applyMaterialAppearance();
  }

  private tick = () => {
    if (this.disposed) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;

    if (this.camTransitionActive) {
      const lambda = 7.5;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.desiredCamPos.x, lambda, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.desiredCamPos.y, lambda, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.desiredCamPos.z, lambda, dt);
      this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.desiredTarget.x, lambda, dt);
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.desiredTarget.y, lambda, dt);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.desiredTarget.z, lambda, dt);
      if (
        this.camera.position.distanceTo(this.desiredCamPos) < 0.03 &&
        this.controls.target.distanceTo(this.desiredTarget) < 0.03
      ) {
        this.camTransitionActive = false;
      }
    }

    // Orientar halos de pines hacia la cámara
    this.pinMeshes.forEach(({ core, halo, baseY }) => {
      const bob = Math.sin(elapsed * 2.8) * 0.02;
      core.position.y = baseY + bob;
      halo.position.y = baseY + bob;
      halo.lookAt(this.camera.position);
    });

    // Deriva de partículas de polvo según viento real del sitio
    if (this.dustPoints && this.params.showDustEffect) {
      const attr = this.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const windSpeed = 0.25 + Math.min(3.5, this.params.sitio.viento[0] * this.params.zona.multViento * 0.14);
      for (let i = 0; i < attr.count; i++) {
        let px = attr.getX(i) + windSpeed * dt;
        if (px > 3.0) px = -3.0;
        attr.setX(i, px);
      }
      attr.needsUpdate = true;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.controls.dispose();
    this.clearGroup(this.terrainGroup);
    this.clearGroup(this.hardwareGroup);
    this.clearGroup(this.pinsGroup);
    this.wearTexture.dispose();
    this.envTexture.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
