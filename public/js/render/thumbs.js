// Renders real 3D tank models into small images for the UI (Index, Q menu, shops...).
import * as THREE from '../../vendor/three.module.min.js';
import { buildTank, disposeTank } from './models.js';

const SIZE = 192;
const cache = new Map();
let R = null, scene = null, cam = null;

function init() {
  const canvas = document.createElement('canvas');
  R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1);
  R.setSize(SIZE, SIZE, false);
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.toneMapping = THREE.NoToneMapping;
  R.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8cce4, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(-4, 10, 8);
  scene.add(sun);
  cam = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
}

const box = new THREE.Box3();
const sphere = new THREE.Sphere();

// body: the original's icons use a red body with light blue barrels.
export function tankIcon(tankId, _size, body = 0xff2b3b) {
  const key = tankId + ':' + body;
  if (cache.has(key)) return cache.get(key);
  if (!R) {
    try { init(); } catch { return ''; }
  }
  const m = buildTank(tankId, 'default', 0, { bodyColor: body, noShadow: true });
  m.rot.rotation.y = -(Math.PI * 0.75); // barrel points toward the viewer's lower-left
  scene.add(m.group);
  box.setFromObject(m.group);
  box.getBoundingSphere(sphere);
  const dist = sphere.radius / Math.sin((cam.fov * Math.PI) / 360) * 1.02;
  const dir = new THREE.Vector3(0, 0.95, 0.78).normalize();
  cam.position.copy(sphere.center).addScaledVector(dir, dist);
  cam.lookAt(sphere.center);
  R.render(scene, cam);
  const url = R.domElement.toDataURL('image/png');
  scene.remove(m.group);
  disposeTank(m);
  cache.set(key, url);
  return url;
}
