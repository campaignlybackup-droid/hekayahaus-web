/**
 * DustScene — the HekayaHaus signature: a field of light dust that gathers into
 * a shape (the name, the H mark) and then releases back into atmosphere.
 * "Beyond seen. Into felt."
 *
 * Orthographic camera in CSS-pixel space so DOM rects map 1:1 to world units.
 * One draw call (THREE.Points + ShaderMaterial). Rendering is driven by the GSAP
 * ticker (single rAF), and pauses when offscreen or the tab is hidden.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three';

const vert = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aTarget;
  attribute vec4 aRand;
  uniform float uTime;
  uniform float uForm;
  uniform float uRelease;
  uniform float uDim;
  uniform float uPR;
  uniform float uSize;
  uniform float uScroll;
  uniform float uMouseStr;
  uniform vec2 uMouse;
  uniform vec2 uParallax;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float isWord = step(0.5, aTarget.z);
    vec3 target = vec3(aTarget.xy, 0.0);

    // gather: staggered, arcing flight from scattered start to target
    float delay = aRand.x * 0.42;
    float t = clamp((uForm - delay) / 0.58, 0.0, 1.0);
    float e = 1.0 - pow(1.0 - t, 3.0);
    vec3 p = mix(aStart, mix(aStart, target, isWord), e);
    p.xy += vec2(sin(aRand.y * 6.2831), cos(aRand.z * 6.2831)) * sin(e * 3.14159) * 140.0 * aRand.w * isWord;

    // breathing shimmer
    float tt = uTime * 0.7 + aRand.y * 40.0;
    p.xy += vec2(sin(tt), cos(tt * 1.27)) * mix(10.0, 0.9, e * isWord);

    // release: back into a slowly drifting atmosphere
    float r = smoothstep(0.0, 1.0, clamp((uRelease - aRand.z * 0.35) / 0.65, 0.0, 1.0));
    vec3 amb = aStart + vec3(
      sin(uTime * 0.11 + aRand.x * 31.0) * 70.0,
      cos(uTime * 0.09 + aRand.y * 27.0) * 60.0,
      0.0);
    p = mix(p, amb, r * isWord);
    p.xy += vec2(sin(uTime * 0.11 + aRand.x * 31.0) * 70.0, cos(uTime * 0.09 + aRand.y * 27.0) * 60.0) * (1.0 - isWord);

    // depth parallax + scroll lift
    p.xy += uParallax * (aRand.w - 0.5) * 60.0;
    p.y += uScroll * (160.0 + aRand.w * 520.0);

    // the visitor's light: dust gently parts around the pointer
    vec2 d = p.xy - uMouse;
    float dist = length(d);
    float f = smoothstep(200.0, 0.0, dist) * uMouseStr;
    p.xy += normalize(d + vec2(0.0001)) * f * 70.0 * (0.4 + aRand.w);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    float formed = e * isWord * (1.0 - r);
    gl_PointSize = uSize * uPR * (0.5 + aRand.w * 1.0) * (1.0 + f * 0.8) * mix(1.0, 0.8, formed);

    float base = 0.28 + 0.72 * aRand.x;
    vAlpha = base * mix(0.6, 1.5, formed) * mix(1.0, uDim, formed) * (1.0 - uScroll * 0.6);

    vec3 tungsten = vec3(1.0, 0.70, 0.36);
    vec3 ivory = vec3(0.94, 0.92, 0.89);
    vec3 cobalt = vec3(0.30, 0.42, 1.0);
    vColor = mix(tungsten, ivory, step(0.42, aRand.y));
    vColor = mix(vColor, cobalt, step(0.84, aRand.z) * (1.0 - formed * 0.7));
  }
`;

const frag = /* glsl */ `
  uniform float uAlpha;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha * uAlpha);
  }
`;

export type TargetFn = (w: number, h: number) => Float32Array; // xy pairs in world (centered px, y up)

export interface DustOptions {
  wordCount: number;
  ambientCount: number;
  size?: number;
  spread?: number; // scatter radius multiplier for start positions
}

export class DustScene {
  renderer: WebGLRenderer;
  scene = new Scene();
  camera = new OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
  geometry = new BufferGeometry();
  material: ShaderMaterial;
  points: Points;
  w = 1;
  h = 1;
  visible = true;
  running = false;
  private mouse = new Vector2(-9999, -9999);
  private mouseTarget = new Vector2(-9999, -9999);
  private parallax = new Vector2();
  private parallaxTarget = new Vector2();
  private mouseStr = 0;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private resizeTimer = 0;

  constructor(
    public canvas: HTMLCanvasElement,
    private targetFn: TargetFn,
    private opts: DustOptions,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.material = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uForm: { value: 0 },
        uRelease: { value: 0 },
        uDim: { value: 1 },
        uPR: { value: 1 },
        uSize: { value: opts.size ?? 3.2 },
        uScroll: { value: 0 },
        uMouse: { value: this.mouse },
        uMouseStr: { value: 0 },
        uParallax: { value: this.parallax },
        uAlpha: { value: 0 },
      },
    });
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    this.resize(true);
    this.io = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting), { rootMargin: '100px' });
    this.io.observe(canvas);
    this.ro = new ResizeObserver(() => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.resize(false), 180);
    });
    this.ro.observe(canvas);

    const host = canvas.parentElement!;
    host.addEventListener('pointermove', this.onPointer, { passive: true });
    host.addEventListener('pointerleave', this.onLeave);
  }

  get u() {
    return this.material.uniforms;
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.mouseTarget.set(e.clientX - r.left - this.w / 2, this.h / 2 - (e.clientY - r.top));
    this.parallaxTarget.set((e.clientX - r.left) / r.width - 0.5, -((e.clientY - r.top) / r.height - 0.5));
    this.mouseStr = 1;
  };
  private onLeave = () => {
    this.mouseStr = 0;
  };

  private resize(initial: boolean) {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (!initial && Math.abs(w - this.w) < 2 && Math.abs(h - this.h) < 80) return; // ignore mobile URL-bar jitter
    this.w = w;
    this.h = h;
    const pr = Math.min(window.devicePixelRatio || 1, w < 768 ? 1.5 : 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.u.uPR.value = pr;
    this.camera.left = -w / 2;
    this.camera.right = w / 2;
    this.camera.top = h / 2;
    this.camera.bottom = -h / 2;
    this.camera.updateProjectionMatrix();
    this.build();
  }

  /** (Re)build particle attributes for the current size. */
  build() {
    const { wordCount, ambientCount, spread = 1 } = this.opts;
    const total = wordCount + ambientCount;
    const targets = this.targetFn(this.w, this.h);
    const tCount = targets.length / 2;
    const start = new Float32Array(total * 3);
    const target = new Float32Array(total * 3);
    const rand = new Float32Array(total * 4);
    const W = this.w * 0.62 * spread;
    const H = this.h * 0.62 * spread;
    for (let i = 0; i < total; i++) {
      // gaussian-ish scatter, denser toward centre
      const a = Math.random() * Math.PI * 2;
      const rr = Math.pow(Math.random(), 0.7);
      start[i * 3] = Math.cos(a) * rr * W + (Math.random() - 0.5) * 40;
      start[i * 3 + 1] = Math.sin(a) * rr * H + (Math.random() - 0.5) * 40;
      start[i * 3 + 2] = 0;
      if (i < wordCount && tCount > 0) {
        const k = i % tCount;
        target[i * 3] = targets[k * 2] + (Math.random() - 0.5) * 1.6;
        target[i * 3 + 1] = targets[k * 2 + 1] + (Math.random() - 0.5) * 1.6;
        target[i * 3 + 2] = 1; // flag: belongs to the shape
      } else {
        target[i * 3] = start[i * 3];
        target[i * 3 + 1] = start[i * 3 + 1];
        target[i * 3 + 2] = 0;
      }
      rand[i * 4] = Math.random();
      rand[i * 4 + 1] = Math.random();
      rand[i * 4 + 2] = Math.random();
      rand[i * 4 + 3] = Math.random();
    }
    this.geometry.setAttribute('position', new BufferAttribute(new Float32Array(total * 3), 3));
    this.geometry.setAttribute('aStart', new BufferAttribute(start, 3));
    this.geometry.setAttribute('aTarget', new BufferAttribute(target, 3));
    this.geometry.setAttribute('aRand', new BufferAttribute(rand, 4));
    this.geometry.setDrawRange(0, total);
  }

  /** Called from GSAP ticker. */
  tick = (time: number) => {
    if (!this.visible || document.hidden) return;
    this.u.uTime.value = time;
    this.mouse.lerp(this.mouseTarget, 0.12);
    this.parallax.lerp(this.parallaxTarget, 0.05);
    this.u.uMouseStr.value += (this.mouseStr - this.u.uMouseStr.value) * 0.06;
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.io.disconnect();
    this.ro.disconnect();
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}

/* ---------- target samplers ---------- */

function sampleCanvas(ctx: CanvasRenderingContext2D, cw: number, ch: number, step: number, max: number, map: (x: number, y: number) => [number, number]) {
  const data = ctx.getImageData(0, 0, cw, ch).data;
  const pts: number[] = [];
  for (let y = 0; y < ch; y += step) {
    for (let x = 0; x < cw; x += step) {
      if (data[(y * cw + x) * 4 + 3] > 140) {
        const [wx, wy] = map(x + (Math.random() - 0.5) * step, y + (Math.random() - 0.5) * step);
        pts.push(wx, wy);
      }
    }
  }
  // shuffle + cap
  const n = pts.length / 2;
  const out = new Float32Array(Math.min(n, max) * 2);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  for (let i = 0; i < out.length / 2; i++) {
    out[i * 2] = pts[idx[i] * 2];
    out[i * 2 + 1] = pts[idx[i] * 2 + 1];
  }
  return out;
}

/** Sample the glyphs of `el` (an inline text element) at its current on-screen position. */
export function textTargets(el: HTMLElement, canvas: HTMLCanvasElement, max: number): TargetFn {
  return (w, h) => {
    const cr = canvas.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const text = (el.textContent || '').trim().toUpperCase();
    const fs = parseFloat(style.fontSize);
    const scale = 2;
    const cw = Math.ceil(r.width * scale) + 8;
    const ch = Math.ceil(r.height * scale) + 8;
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const font = `${style.fontWeight} ${fs * scale}px ${style.fontFamily}`;
    ctx.font = `ultra-expanded ${font}`;
    if (!ctx.font.includes('px')) ctx.font = font;
    try {
      (ctx as any).fontStretch = 'ultra-expanded';
      (ctx as any).letterSpacing = style.letterSpacing === 'normal' ? '0px' : `${parseFloat(style.letterSpacing) * scale}px`;
    } catch {}
    const m = ctx.measureText(text);
    const sx = (r.width * scale) / Math.max(1, m.width);
    ctx.setTransform(sx, 0, 0, 1, 4, 0);
    ctx.fillText(text, 0, ch / 2 + fs * scale * 0.04);
    const step = Math.max(2, Math.round(Math.sqrt((r.width * r.height * scale * scale * 0.42) / max)));
    const ox = r.left - cr.left;
    const oy = r.top - cr.top;
    return sampleCanvas(ctx, cw, ch, step, max, (x, y) => [ox + (x - 4) / scale - w / 2, h / 2 - (oy + (y - 4) / scale)]);
  };
}

/** Sample an image (white-on-transparent mark) fitted into a box centred in the canvas. */
export function imageTargets(img: HTMLImageElement, boxFrac: number, max: number, offsetY = 0): TargetFn {
  return (w, h) => {
    const box = Math.min(w, h) * boxFrac;
    const ar = img.naturalWidth / img.naturalHeight;
    const iw = Math.round(ar >= 1 ? box : box * ar);
    const ih = Math.round(ar >= 1 ? box / ar : box);
    const c = document.createElement('canvas');
    c.width = iw;
    c.height = ih;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, iw, ih);
    const step = Math.max(2, Math.round(Math.sqrt((iw * ih * 0.5) / max)));
    return sampleCanvas(ctx, iw, ih, step, max, (x, y) => [x - iw / 2, ih / 2 - y + offsetY]);
  };
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/** Rough device tier: 0 = no 3D, 1 = reduced, 2 = full. */
export function deviceTier(): 0 | 1 | 2 {
  if (!webglAvailable()) return 0;
  const nav = navigator as any;
  if (nav.connection?.saveData) return 0;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = nav.deviceMemory || 4;
  const small = window.innerWidth < 768;
  if (cores <= 2 || mem <= 2) return 1;
  return small ? 1 : 2;
}
