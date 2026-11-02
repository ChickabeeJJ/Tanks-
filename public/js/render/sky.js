// Cinematic procedural skybox: deep zenith -> warm horizon gradient, HDR sun disc + glow,
// drifting sunlit clouds above, and a sea of clouds below the horizon.
import * as THREE from '../../vendor/three.module.min.js';

const VERT = `varying vec3 vDir;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  vec4 p = projectionMatrix * viewMatrix * wp;
  gl_Position = p.xyww; // always on the far plane
}`;

const FRAG = `uniform vec3 uSun; uniform float uTime; uniform float uLinear; varying vec3 vDir;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  float s = max(dot(d, uSun), 0.0);
  vec3 zen = vec3(0.05, 0.30, 0.85);
  vec3 mid = vec3(0.22, 0.56, 0.98);
  vec3 hor = vec3(0.70, 0.85, 1.00);
  vec3 warm = vec3(1.00, 0.86, 0.68);
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.12, h));
  col = mix(col, zen, smoothstep(0.12, 0.7, h));
  // warm haze toward the sun near the horizon
  col = mix(col, warm, pow(s, 6.0) * (1.0 - smoothstep(0.0, 0.5, abs(h))) * 0.55);
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.14);
    float c = fbm(uv * 0.9 + vec2(uTime * 0.008, uTime * 0.003));
    c = smoothstep(0.6, 0.9, c) * smoothstep(0.05, 0.3, h);
    float lit = 0.82 + 0.18 * fbm(uv * 1.8 - uTime * 0.01);
    vec3 cc = mix(vec3(0.96, 0.97, 1.0) * lit, vec3(1.0, 0.93, 0.82), pow(s, 3.0) * 0.8);
    col = mix(col, cc, c * 0.85);
  } else {
    // sea of clouds below the floating lobby
    vec2 uv = d.xz / (-h + 0.12);
    float c = fbm(uv * 0.55 + vec2(uTime * 0.004, 0.0));
    vec3 sea = mix(vec3(0.78, 0.86, 0.97), vec3(1.0), smoothstep(0.35, 0.75, c));
    sea = mix(sea, warm, pow(s, 4.0) * 0.25);
    col = mix(hor, sea, smoothstep(0.0, -0.08, h));
  }
  // sun: HDR disc (feeds the bloom) + soft glow
  col += vec3(1.0, 0.9, 0.72) * smoothstep(0.9993, 0.9997, s) * 6.0;
  col += vec3(1.0, 0.85, 0.6) * pow(s, 64.0) * 0.6 + vec3(1.0, 0.9, 0.75) * pow(s, 8.0) * 0.18;
  if (uLinear > 0.5) col = pow(col, vec3(2.2));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky(sunDir, linear) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sunDir.clone().normalize() }, uTime: { value: 0 }, uLinear: { value: linear ? 1 : 0 } },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return {
    mesh,
    update(dt, camera) {
      mat.uniforms.uTime.value += dt;
      mesh.position.copy(camera.position);
    },
  };
}
