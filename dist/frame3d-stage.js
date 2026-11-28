// The diorama's stage (presentation only): the renderer, a camera looking down across the island from the south at
// a slow drift, the world's sun as the light that casts the shadows, sky light and haze by the sun's height, a dim
// blue moonlight at night, and the miniature look: the top and bottom of the picture out of focus (tilt-shift),
// colours a touch richer, edges a touch darker.
import * as THREE from './vendor/three.min.js';
import { skyLight } from './frame-render.js';

export function makeStage(canvas, size) {
  const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(28, 16 / 9, 1, 500),
    centre = new THREE.Vector3(size[0] / 2, 0, size[1] / 2);
  const sun = new THREE.DirectionalLight(0xffffff, 3),
    sky = new THREE.HemisphereLight(0xbfd6ff, 0x5a4a30, 0.9),
    moon = new THREE.DirectionalLight(0x8fa6d8, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 220 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.03;
  sun.target.position.copy(centre);
  moon.position.set(centre.x - 30, 60, centre.z - 20);
  moon.target.position.copy(centre);
  scene.add(sun, sun.target, sky, moon, moon.target);
  scene.fog = new THREE.Fog(0x9fb8d0, 80, 260);
  return { renderer, scene, camera, sun, sky, moon, centre, post: makeTilt(renderer) };
}
const SKY = { day: [0.62, 0.74, 0.86], low: [0.93, 0.68, 0.46], dusk: [0.32, 0.33, 0.5], night: [0.04, 0.06, 0.12] };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
function skyColour(el) {
  if (el > 12) return SKY.day;
  if (el > 0) return mix(SKY.low, SKY.day, el / 12);
  if (el > -6) return mix(SKY.dusk, SKY.low, (el + 6) / 6);
  return mix(SKY.night, SKY.dusk, (el + 12) / 6);
}
// The light for the world's sun this moment (sun: x east, y south, z up, el degrees, from frame-render.js).
export function lightFor(st, sun) {
  const up = Math.max(0, sun.z),
    tint = skyLight(sun.el),
    night = Math.min(1, Math.max(0, -sun.el / 8));
  st.sun.position.set(st.centre.x + sun.x * 90, sun.z * 90, st.centre.z + sun.y * 90);
  st.sun.color.setRGB(...tint.map(v => Math.min(1, v)));
  st.sun.intensity = sun.el > 0 ? 1 + 2.4 * Math.sqrt(up) : 0;
  st.sky.intensity = 0.25 + 0.75 * Math.min(1, Math.max(0, (sun.el + 6) / 18));
  st.moon.intensity = 0.55 * night;
  const c = new THREE.Color().setRGB(...skyColour(sun.el));
  st.scene.background = c;
  st.scene.fog.color.copy(c);
  return night;
}
// The camera: across the island from the south, 50 degrees down, swinging gently either way over ten minutes.
// close: a point to look at from near by (x, z in kilometres), in place of the whole island.
export function aim(st, t, aspect, close = null) {
  const turn = 0.12 * Math.sin((t / 600000) * Math.PI * 2),
    tilt = ((close ? 38 : 50) * Math.PI) / 180,
    reach = close ? 7 : (st.centre.x * 1.05) / Math.tan(Math.atan(Math.tan((14 * Math.PI) / 180) * aspect)),
    at = close ? new THREE.Vector3(close[0], 0, close[1]) : st.centre;
  st.camera.aspect = aspect;
  st.camera.position.set(
    at.x + Math.sin(turn) * Math.cos(tilt) * reach,
    Math.sin(tilt) * reach,
    at.z + Math.cos(turn) * Math.cos(tilt) * reach,
  );
  st.camera.lookAt(at.x, 0, at.z + (close ? 0 : 1.5));
  st.camera.updateProjectionMatrix();
}
const TILT_SHADER = `
uniform sampler2D tex; uniform vec2 px; varying vec2 vUv;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  float d = max(0.0, abs(vUv.y - 0.52) - 0.17), r = min(1.0, d * 3.5) * 9.0;
  vec3 c = vec3(0.0);
  for (int i = 0; i < 24; i++) {
    float a = float(i) * 2.39996, k = sqrt((float(i) + 0.5) / 24.0) * r;
    c += texture2D(tex, vUv + vec2(cos(a), sin(a)) * k * px).rgb;
  }
  c = pow(aces(c / 24.0 * 1.1), vec3(1.0 / 2.2));
  c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, 1.15);
  c *= mix(0.78, 1.0, smoothstep(0.95, 0.35, length((vUv - 0.5) * vec2(1.0, 0.8))));
  gl_FragColor = vec4(c, 1.0);
}`;
// Draw the scene to a picture, then to the screen through the miniature look.
function makeTilt(renderer) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
    mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: target.texture }, px: { value: new THREE.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: TILT_SHADER,
      depthTest: false,
      depthWrite: false,
    }),
    quad = new THREE.Scene(),
    cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  return {
    resize(w, h) {
      target.setSize(w, h);
      mat.uniforms.px.value.set(1 / w, 1 / h);
    },
    render(scene, camera) {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(quad, cam);
    },
  };
}
