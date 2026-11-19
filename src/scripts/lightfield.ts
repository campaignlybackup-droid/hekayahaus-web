/**
 * LightField — a projector-light shader for inner-page heroes.
 * Volumetric tungsten beams from the top-right, a cobalt counter-light from the
 * lower-left, drifting dust caught in the light. Raw WebGL (no library), one
 * full-screen triangle, rendered at reduced resolution and paused offscreen.
 */
const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uFade;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

float beams(vec2 uv, vec2 src, float spread, float t, float seed){
  vec2 d = uv - src;
  float ang = atan(d.y, d.x);
  float dist = length(d);
  float rays = fbm(vec2(ang * 9.0 + seed, t * 0.07 + seed));
  rays = pow(smoothstep(0.38, 0.82, rays), 1.4);
  float cone = smoothstep(spread, 0.0, abs(ang - atan(-0.75, -0.62)));
  float fall = exp(-dist * 0.85);
  return rays * fall * (0.25 + cone * 1.2);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 st = vec2(uv.x * uRes.x / uRes.y, uv.y);
  float ar = uRes.x / uRes.y;
  float t = uTime;

  vec2 key = vec2(ar * 0.86 + uPointer.x * 0.06, 1.12 + uPointer.y * 0.04);
  vec2 fill = vec2(-0.15 + uPointer.x * 0.03, -0.2);

  float k = beams(st, key, 1.4, t, 0.0);
  float f = beams(st, fill, 1.8, t * 0.8, 7.3) * 0.55;

  // soft haze around the sources
  float haze = exp(-length(st - key) * 1.6) * 0.45 + exp(-length(st - fill) * 2.2) * 0.25;

  vec3 tungsten = vec3(1.0, 0.70, 0.36);
  vec3 cobalt = vec3(0.23, 0.36, 1.0);
  vec3 col = tungsten * (k * 0.8 + haze * 0.42) + cobalt * (f * 0.75 + exp(-length(st - fill) * 2.2) * 0.22);

  // dust motes drifting through the light
  vec2 g = st * 38.0 + vec2(t * 0.25, -t * 0.4);
  vec2 id = floor(g);
  float h = hash(id);
  vec2 c = fract(g) - 0.5 + (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.6;
  float mote = smoothstep(0.06, 0.0, length(c)) * step(0.93, h) * (0.5 + 0.5 * sin(t * 2.0 + h * 40.0));
  col += tungsten * mote * (k * 3.0 + haze * 1.2);

  // bottom fade into page
  col *= smoothstep(0.0, 0.35, uv.y) * uFade;
  float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}
`;

export function initLightField(host: HTMLElement, ticker: { add: (fn: (t: number) => void) => void }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'lightfield';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: false });
  if (!gl) return;
  host.prepend(canvas);

  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    canvas.remove();
    return;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uPointer = gl.getUniformLocation(prog, 'uPointer');
  const uFade = gl.getUniformLocation(prog, 'uFade');

  const scale = window.innerWidth < 768 ? 0.4 : 0.5; // render small, upscale (it is all soft light)
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(2, Math.round(r.width * scale));
    canvas.height = Math.max(2, Math.round(r.height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  };
  resize();
  new ResizeObserver(resize).observe(canvas);

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  const p = { x: 0, y: 0, tx: 0, ty: 0 };
  host.addEventListener(
    'pointermove',
    (e) => {
      const r = host.getBoundingClientRect();
      p.tx = (e.clientX - r.left) / r.width - 0.5;
      p.ty = -((e.clientY - r.top) / r.height - 0.5);
    },
    { passive: true },
  );

  let fade = 0;
  const frame = (time: number) => {
    if (!visible || document.hidden) return;
    p.x += (p.tx - p.x) * 0.04;
    p.y += (p.ty - p.y) * 0.04;
    fade = Math.min(1, fade + 0.02);
    gl.uniform1f(uTime, time);
    gl.uniform2f(uPointer, p.x, p.y);
    gl.uniform1f(uFade, fade);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  ticker.add(frame);
  host.classList.add('has-lightfield');
}
