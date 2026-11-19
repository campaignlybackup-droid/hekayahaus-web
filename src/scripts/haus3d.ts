/**
 * HausScene — the HekayaHaus H mark as a physical object.
 * Six pieces traced from the brand mark, grouped into the three pillars
 * (01 Marketing = left ribbons, 02 Performance = corner blocks, 03 Growth = right ribbons).
 * A single progress value (0–1) drives the story: scattered in space → each pillar
 * locks into place → one Haus, lit and turning to face the visitor.
 */
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  Shape,
  SpriteMaterial,
  Sprite,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import hmark from '../data/hmark.json';

type Piece = { mesh: Mesh; group: number; from: Vector3; fromRot: Vector3; mat: MeshPhysicalMaterial };

const TUNGSTEN = new Color('#ffb35c');
const COBALT = new Color('#3a5bff');

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,190,110,0.9)');
  grd.addColorStop(0.35, 'rgba(255,150,70,0.28)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export interface HausOptions {
  quality: 1 | 2;
  /** start assembled (About page) */
  assembled?: boolean;
  /** allow drag-to-rotate */
  draggable?: boolean;
}

export class HausScene {
  renderer: WebGLRenderer;
  scene = new Scene();
  camera = new PerspectiveCamera(32, 1, 0.1, 100);
  root = new Group();
  pieces: Piece[] = [];
  progress = 0; // 0..1 story progress
  focus = -1; // highlighted pillar (0..2) or -1
  visible = true;
  private pointer = new Vector2();
  private pointerT = new Vector2();
  private drag = { active: false, x: 0, rot: 0, vel: 0 };
  private key: PointLight;
  private rim: PointLight;
  private glow: Sprite;
  private dust: Points;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private time = 0;

  constructor(
    public canvas: HTMLCanvasElement,
    private opts: HausOptions,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: opts.quality === 2, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = SRGBColorSpace;

    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera.position.set(0, 0, 4.2);
    this.scene.add(this.root);

    // lights: warm key (tungsten), cool rim (cobalt), soft fill
    this.key = new PointLight(TUNGSTEN, 18, 12, 1.6);
    this.key.position.set(1.6, 1.2, 2.2);
    this.rim = new PointLight(COBALT, 26, 12, 1.6);
    this.rim.position.set(-2.2, -0.6, -1.2);
    const fill = new DirectionalLight(0xffffff, 0.35);
    fill.position.set(0, 2, 3);
    this.scene.add(this.key, this.rim, fill);

    // halo behind the mark
    this.glow = new Sprite(new SpriteMaterial({ map: glowTexture(), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.glow.scale.set(3.4, 3.4, 1);
    this.glow.position.z = -0.8;
    this.scene.add(this.glow);

    this.buildPieces();
    this.dust = this.buildDust(opts.quality === 2 ? 700 : 320);
    this.scene.add(this.dust);

    if (opts.assembled) this.progress = 1;

    this.resize();
    this.io = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting), { rootMargin: '120px' });
    this.io.observe(canvas);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);

    const host = canvas.parentElement!;
    host.addEventListener('pointermove', this.onMove, { passive: true });
    host.addEventListener('pointerleave', () => this.pointerT.set(0, 0));
    if (opts.draggable) {
      canvas.style.touchAction = 'pan-y';
      canvas.addEventListener('pointerdown', (e) => {
        this.drag.active = true;
        this.drag.x = e.clientX;
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointerup', () => (this.drag.active = false));
      canvas.addEventListener('pointercancel', () => (this.drag.active = false));
      canvas.addEventListener('pointermove', (e) => {
        if (!this.drag.active) return;
        const dx = e.clientX - this.drag.x;
        this.drag.x = e.clientX;
        this.drag.vel = dx * 0.01;
        this.drag.rot += dx * 0.01;
      });
    }
  }

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.pointerT.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  };

  private buildPieces() {
    const SIZE = 1.42; // world height of the mark
    const depth = 0.16;
    hmark.pieces.forEach((p) => {
      const s = new Shape();
      p.pts.forEach(([x, y], k) => (k ? s.lineTo(x * SIZE, y * SIZE) : s.moveTo(x * SIZE, y * SIZE)));
      s.closePath();
      const geo = new ExtrudeGeometry(s, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.025,
        bevelSize: 0.012,
        bevelSegments: this.opts.quality === 2 ? 4 : 2,
        curveSegments: 4,
      });
      geo.translate(0, 0, -depth / 2);
      geo.computeVertexNormals();
      const mat = new MeshPhysicalMaterial({
        color: new Color('#0e0f13'),
        metalness: 0.9,
        roughness: 0.28,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        envMapIntensity: 0.62,
        emissive: TUNGSTEN.clone(),
        emissiveIntensity: 0,
      });
      const mesh = new Mesh(geo, mat);
      // scattered "from" state: pushed outward, forward/back in depth, tumbling
      const dir = new Vector3(p.pts.reduce((a, q) => a + q[0], 0) / p.pts.length, p.pts.reduce((a, q) => a + q[1], 0) / p.pts.length, 0).normalize();
      const from = new Vector3(dir.x * (0.9 + Math.random() * 0.5), dir.y * (0.7 + Math.random() * 0.4) + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 1.6 - 0.2);
      const fromRot = new Vector3((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 3.2, (Math.random() - 0.5) * 1.6);
      this.root.add(mesh);
      this.pieces.push({ mesh, group: p.g, from, fromRot, mat });
    });
  }

  private buildDust(n: number) {
    const geo = new BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 7;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4 - 0.5;
    }
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    const mat = new PointsMaterial({ color: TUNGSTEN, size: 0.012, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    return new Points(geo, mat);
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    const pr = Math.min(window.devicePixelRatio || 1, this.opts.quality === 2 ? 2 : 1.5);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the whole mark in frame on tall/narrow canvases
    this.camera.position.z = w / h < 0.85 ? 4.2 / Math.max(0.55, w / h / 0.85) : 4.2;
    this.camera.updateProjectionMatrix();
  }

  /** per-piece eased progress: each pillar group arrives in sequence */
  private groupT(g: number) {
    const start = 0.12 + g * 0.2;
    const t = Math.min(1, Math.max(0, (this.progress - start) / 0.28));
    return 1 - Math.pow(1 - t, 3);
  }

  tick = (t: number) => {
    if (!this.visible || document.hidden) return;
    const dt = Math.min(0.05, t - this.time || 0.016);
    this.time = t;
    this.pointer.lerp(this.pointerT, 0.06);

    const assembled = Math.min(1, Math.max(0, (this.progress - 0.78) / 0.22));
    for (const p of this.pieces) {
      const e = this.groupT(p.group);
      const float = (1 - e) * 0.08;
      p.mesh.position.set(
        p.from.x * (1 - e),
        p.from.y * (1 - e) + Math.sin(t * 0.8 + p.from.x * 3) * float,
        p.from.z * (1 - e),
      );
      p.mesh.rotation.set(p.fromRot.x * (1 - e) + Math.sin(t * 0.5 + p.from.y) * float, p.fromRot.y * (1 - e), p.fromRot.z * (1 - e));
      const lit = this.focus === p.group ? 1 : 0;
      p.mat.emissiveIntensity += (lit * 0.16 - p.mat.emissiveIntensity) * 0.08;
    }

    // whole object: slow turn while scattered, faces visitor when assembled, follows pointer
    if (this.opts.draggable) {
      if (!this.drag.active) {
        this.drag.vel *= 0.94;
        this.drag.rot += this.drag.vel;
        this.drag.rot *= 0.985; // ease home
      }
    }
    const idle = (1 - assembled) * Math.sin(t * 0.25) * 0.5;
    this.root.rotation.y = idle + this.pointer.x * 0.35 + this.drag.rot + (1 - assembled) * -0.4;
    this.root.rotation.x = -this.pointer.y * 0.22 + Math.sin(t * 0.4) * 0.03;
    this.root.position.y = Math.sin(t * 0.6) * 0.03;

    // light sweep on assembly
    this.key.position.x = 1.6 + Math.sin(t * 0.5) * 0.6 + this.pointer.x * 0.8;
    this.key.position.y = 1.2 + this.pointer.y * 0.6;
    this.key.intensity = 16 + assembled * 18;
    const gm = this.glow.material as SpriteMaterial;
    gm.opacity += (0.15 + assembled * 0.55 - gm.opacity) * 0.05;

    this.dust.rotation.y += dt * 0.02;
    this.dust.position.y = Math.sin(t * 0.2) * 0.05;

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.io.disconnect();
    this.ro.disconnect();
    this.pieces.forEach((p) => {
      p.mesh.geometry.dispose();
      p.mat.dispose();
    });
    this.renderer.dispose();
  }
}

