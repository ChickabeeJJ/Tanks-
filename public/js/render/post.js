// Cinematic post-processing: HDR scene buffer -> bloom -> soft highlight roll-off,
// colour grade (warm highlights / cool shadows), vignette and fine grain.
import * as THREE from '../../vendor/three.module.min.js';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT = `uniform sampler2D tSrc; uniform float uThreshold; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold + 0.55, l), 1.0);
}`;

const BLUR = `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main(){
  vec3 s = texture2D(tSrc, vUv).rgb * 0.227027;
  s += texture2D(tSrc, vUv + uDir * 1.3846).rgb * 0.316216;
  s += texture2D(tSrc, vUv - uDir * 1.3846).rgb * 0.316216;
  s += texture2D(tSrc, vUv + uDir * 3.2308).rgb * 0.070270;
  s += texture2D(tSrc, vUv - uDir * 3.2308).rgb * 0.070270;
  gl_FragColor = vec4(s, 1.0);
}`;

const FINAL = `uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uBloom; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
vec3 knee(vec3 x){ // keep colours as-is up to 0.82, then roll highlights off softly instead of clipping
  vec3 k = vec3(0.82);
  vec3 over = max(x - k, 0.0);
  return min(x, k) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 c = texture2D(tScene, vUv).rgb;
  vec3 b = texture2D(tBloom, vUv).rgb;
  c += b * uBloom;
  c = knee(c);
  c = toSRGB(clamp(c, 0.0, 1.0));
  // grade: gentle S-curve contrast, saturation, warm highlights / cool shadows
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 1.14);
  c += vec3(0.020, 0.008, -0.018) * smoothstep(0.45, 1.0, l);
  c += vec3(-0.012, 0.0, 0.022) * (1.0 - smoothstep(0.0, 0.45, l));
  // vignette
  vec2 d = vUv - 0.5;
  d.x *= uRes.x / uRes.y;
  c *= mix(1.0, 0.80, smoothstep(0.42, 1.05, length(d)));
  // fine film grain
  c += (hash(vUv * uRes + uTime) - 0.5) * 0.018;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export class Post {
  constructor(renderer) {
    this.r = renderer;
    const opts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.scene = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.a = new THREE.WebGLRenderTarget(4, 4, opts);
    this.b = new THREE.WebGLRenderTarget(4, 4, opts);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.q = new THREE.Scene();
    this.q.add(this.quad);
    const mk = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.mBright = mk(BRIGHT, { tSrc: { value: null }, uThreshold: { value: 0.9 } });
    this.mBlur = mk(BLUR, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.mFinal = mk(FINAL, {
      tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.55 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    });
    this.t = 0;
  }

  setSize(w, h) {
    const pr = this.r.getPixelRatio();
    const W = Math.max(1, Math.floor(w * pr)), H = Math.max(1, Math.floor(h * pr));
    this.scene.setSize(W, H);
    const bw = Math.max(1, W >> 2), bh = Math.max(1, H >> 2);
    this.a.setSize(bw, bh);
    this.b.setSize(bw, bh);
    this.bw = bw; this.bh = bh;
    this.mFinal.uniforms.uRes.value.set(W, H);
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.q, this.cam);
  }

  render(scene, camera, dt = 0.016) {
    const r = this.r;
    r.setRenderTarget(this.scene);
    r.render(scene, camera);
    // bloom: bright pass at 1/4 res, two separable blur iterations
    this.mBright.uniforms.tSrc.value = this.scene.texture;
    this.pass(this.mBright, this.a);
    for (let i = 0; i < 2; i++) {
      this.mBlur.uniforms.tSrc.value = this.a.texture;
      this.mBlur.uniforms.uDir.value.set((1 + i) / this.bw, 0);
      this.pass(this.mBlur, this.b);
      this.mBlur.uniforms.tSrc.value = this.b.texture;
      this.mBlur.uniforms.uDir.value.set(0, (1 + i) / this.bh);
      this.pass(this.mBlur, this.a);
    }
    this.t += dt;
    this.mFinal.uniforms.tScene.value = this.scene.texture;
    this.mFinal.uniforms.tBloom.value = this.a.texture;
    this.mFinal.uniforms.uTime.value = this.t % 100;
    this.pass(this.mFinal, null);
  }
}
