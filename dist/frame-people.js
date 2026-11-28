// People on the frame as small human figures (presentation only): a head, a body in their own cloth, arms and legs
// that swing while they walk, a shadow cast away from the world's sun by day, a faint warm halo at night so they
// can still be seen. Children are drawn smaller by age. Canvas 2D is enough for figures this size.
const SKIN = ['94,62,44', '84,54,38', '104,70,48', '76,50,36'];
const CLOTH = ['176,112,62', '158,74,48', '214,196,160', '120,84,52', '196,150,80', '92,96,70'];
const pick = (list, id, k) => list[(id * k) % list.length];

// The shadow on the ground, away from the sun (sun.x east, sun.y south, as frame-render.js gives it).
function shadow(g, x, y, h, sun) {
  if (sun.el <= 2) return;
  const flat = Math.hypot(sun.x, sun.y) || 1,
    len = Math.min(2.5, 1 / Math.tan((sun.el * Math.PI) / 180)) * h * 0.6;
  g.save();
  g.translate(x - (sun.x / flat) * len * 0.5, y - (sun.y / flat) * len * 0.5);
  g.rotate(Math.atan2(-sun.y, -sun.x));
  g.fillStyle = 'rgba(10,14,8,0.3)';
  g.beginPath();
  g.ellipse(0, 0, len * 0.5 + h * 0.1, h * 0.12, 0, 0, 7);
  g.fill();
  g.restore();
}
function halo(g, x, y, h, night) {
  if (night < 0.2) return;
  const r = h * 1.1,
    c = g.createRadialGradient(x, y - h * 0.5, 0, x, y - h * 0.5, r);
  c.addColorStop(0, `rgba(255,214,150,${0.3 * night})`);
  c.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = c;
  g.fillRect(x - r, y - h * 0.5 - r, 2 * r, 2 * r);
}
// Legs from the hips and arms from the shoulders, swinging opposite each other by s pixels.
function limbs(g, x, y, h, s, skin) {
  const w = Math.max(1, h * 0.1);
  g.lineCap = 'round';
  g.lineWidth = w;
  g.strokeStyle = skin;
  g.beginPath();
  for (const side of [-1, 1]) {
    g.moveTo(x + side * w * 0.4, y - h * 0.44);
    g.lineTo(x + side * w * 0.4 - side * s, y);
    g.moveTo(x + side * h * 0.13, y - h * 0.74);
    g.lineTo(x + side * (h * 0.15 + s * 0.7), y - h * 0.42);
  }
  g.stroke();
}
function bodyAndHead(g, p, x, y, h, skin, cloth) {
  const hip = p.sex === 'F' ? 0.16 : 0.1;
  g.fillStyle = cloth;
  g.beginPath();
  g.moveTo(x - h * 0.12, y - h * 0.78);
  g.lineTo(x + h * 0.12, y - h * 0.78);
  g.lineTo(x + h * hip, y - h * 0.38);
  g.lineTo(x - h * hip, y - h * 0.38);
  g.fill();
  g.fillStyle = skin;
  g.beginPath();
  g.arc(x, y - h * 0.88, h * 0.11, 0, 7);
  g.fill();
}
// One person standing at (x, y) (the feet), h pixels tall; swing -1..1 is the stride, 0 standing still.
export function drawFigure(g, p, x, y, h, swing, sun, night) {
  const lit = 1 - 0.5 * night,
    skin = `rgba(${pick(SKIN, p.id, 7)},${lit})`,
    cloth = `rgba(${pick(CLOTH, p.id, 13)},${lit})`;
  shadow(g, x, y, h, sun);
  halo(g, x, y, h, night);
  limbs(g, x, y, h, swing * h * 0.16, skin);
  bodyAndHead(g, p, x, y, h, skin, cloth);
}
// How tall a person is drawn: adults about a square of the map; children from half that, growing to 14.
export const heightOf = (p, px) => Math.max(7, px * 1.1) * (p.body.age < 14 ? 0.5 + (0.5 * p.body.age) / 14 : 1);
