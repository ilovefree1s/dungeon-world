// ============================================================================
//  DUNGEON WORLD  -  heroanim: the heroes' attack animations, laid over
//  Dungeon Heart's animHero. Each attack is a few keyframed poses of the whole
//  body (torso twist and lean, both arms, the legs' stance, the head) with a
//  wind-up, a fast strike and an easing recovery back into whatever the legs
//  were doing. The warrior alternates a downward slash and a backhand, spins
//  for the whirlwind and tucks for the slam (and lands in a crouch); the mage
//  thrusts the staff for a bolt, flings both arms wide for the nova and
//  raises the staff to the sky for the meteor; the hunter draws side-on and
//  snaps the string, fans the multishot and aims the rain straight up.
// ============================================================================
const TAU = Math.PI * 2;
// a pose: body rotation and lift, each arm's rotation, each leg's swing, the head's turn
//   (arms: x < 0 raises the hand forward, z moves it out to the side: + for the right arm, - for the left)
const field = (bx, by, bz, dy, ra, la, rl, ll, hy, hx = 0) => ({ bx, by, bz, dy, ra, la, rl, ll, hy, hx });
const ease = { lin: u => u, in: u => u * u, out: u => 1 - (1 - u) * (1 - u), io: u => u * u * (3 - 2 * u), snap: u => 1 - Math.pow(1 - u, 4) };
const mix = (a, b, u) => a + (b - a) * u;
function lerpPose(a, b, u) {
  return field(mix(a.bx, b.bx, u), mix(a.by, b.by, u), mix(a.bz, b.bz, u), mix(a.dy, b.dy, u),
    [mix(a.ra[0], b.ra[0], u), mix(a.ra[1], b.ra[1], u), mix(a.ra[2], b.ra[2], u)],
    [mix(a.la[0], b.la[0], u), mix(a.la[1], b.la[1], u), mix(a.la[2], b.la[2], u)],
    mix(a.rl, b.rl, u), mix(a.ll, b.ll, u), mix(a.hy, b.hy, u), mix(a.hx, b.hx, u));
}
// the pose the body is in now (what animHero and the jump left it in): the recovery blends back into it
function readPose(u) {
  return field(u.body.rotation.x, u.body.rotation.y, u.body.rotation.z, 0,
    [u.arms[1].rotation.x, u.arms[1].rotation.y, u.arms[1].rotation.z], [u.arms[0].rotation.x, u.arms[0].rotation.y, u.arms[0].rotation.z],
    u.legs[1].rotation.x, u.legs[0].rotation.x, u.head.rotation.y, u.head.rotation.x);
}
function applyPose(u, p) {
  u.body.rotation.set(p.bx, p.by, p.bz); u.body.position.y += p.dy;
  u.arms[1].rotation.set(p.ra[0], p.ra[1], p.ra[2]); u.arms[0].rotation.set(p.la[0], p.la[1], p.la[2]);
  u.legs[1].rotation.x = p.rl; u.legs[0].rotation.x = p.ll;
  u.head.rotation.y = p.hy; u.head.rotation.x = p.hx;
}
// keys: [{ t, e, ...pose }], t rising from 0 to 1, e the easing into that key; a key with pose null is the base pose
function sample(keys, k, base) {
  const P = i => keys[i].p || base;
  if (k <= keys[0].t) return P(0);
  for (let i = 1; i < keys.length; i++) {
    if (k <= keys[i].t) { const u = (k - keys[i - 1].t) / (keys[i].t - keys[i - 1].t); return lerpPose(P(i - 1), P(i), ease[keys[i].e || 'io'](u)); }
  }
  return P(keys.length - 1);
}
const K = (t, e, p) => ({ t, e, p });

// ---------------------------------------------------------------- the warrior
// a slash from high on the right down across to the left; the next one comes back the other way
const SLASH = [
  K(0, 'lin', null),
  K(0.22, 'out', field(-0.12, 0.75, 0.05, 0.02, [-2.9, 0.3, 0.5], [-0.9, 0, -0.5], -0.35, 0.3, -0.5)),       // wound up: torso twisted, sword high and back
  K(0.28, 'lin', field(-0.08, 0.6, 0.05, 0, [-2.9, 0.3, 0.5], [-0.9, 0, -0.5], -0.35, 0.3, -0.4)),           // a beat
  K(0.5, 'snap', field(0.28, -0.75, -0.08, -0.08, [-0.35, -0.2, -0.3], [-1.3, 0, -0.9], 0.45, -0.5, 0.5)),  // the cut: whips across, weight onto the front foot
  K(0.68, 'lin', field(0.26, -0.7, -0.08, -0.08, [-0.3, -0.2, -0.3], [-1.2, 0, -0.9], 0.45, -0.5, 0.5)),    // follow-through
  K(1, 'io', null),
];
const BACKHAND = [
  K(0, 'lin', null),
  K(0.22, 'out', field(-0.1, -0.7, -0.05, 0.02, [-1.4, 0.2, -1.1], [-0.6, 0, -0.2], 0.3, -0.35, 0.45)),     // the sword tucked across the body on the left
  K(0.28, 'lin', field(-0.06, -0.6, -0.05, 0, [-1.4, 0.2, -1.1], [-0.6, 0, -0.2], 0.3, -0.35, 0.4)),
  K(0.5, 'snap', field(0.25, 0.8, 0.08, -0.08, [-1.1, -0.3, 1.5], [-1.0, 0, -0.7], -0.45, 0.5, -0.5)),     // flung out to the right
  K(0.68, 'lin', field(0.22, 0.75, 0.08, -0.08, [-1.0, -0.3, 1.5], [-0.9, 0, -0.7], -0.45, 0.5, -0.5)),
  K(1, 'io', null),
];
// the whirlwind: a low stance, both arms out, two full turns
const WHIRL_ARMS = field(0.15, 0, 0, -0.12, [-0.9, 0, 1.45], [-0.9, 0, -1.45], 0.5, -0.5, 0);
function whirl(k, base) {
  const p = k < 0.12 ? lerpPose(base, WHIRL_ARMS, ease.out(k / 0.12)) : k > 0.85 ? lerpPose(WHIRL_ARMS, base, ease.io((k - 0.85) / 0.15)) : WHIRL_ARMS;
  const spin = k < 0.12 ? 0 : ease.lin(Math.min(1, (k - 0.12) / 0.78));
  return { ...p, by: p.by - spin * 2 * TAU };
}
// the slam: in the air, sword raised in both hands over the head, knees up; landing, a deep crouch
const SLAM_AIR = field(-0.25, 0, 0, 0, [-3.1, 0, 0.25], [-3.0, 0, -0.25], -0.9, -0.9, 0, -0.5);
const SLAM_DOWN = field(0.55, 0, 0, -0.42, [-0.9, 0, 0.35], [-0.6, 0, -0.5], 0.9, -1.1, 0, 0.35);
const LAND = [K(0, 'lin', SLAM_DOWN), K(0.5, 'lin', SLAM_DOWN), K(1, 'io', null)];

// ---------------------------------------------------------------- the mage
// a bolt: the staff drawn back to the shoulder, then thrust at the target with the off hand pushing too
const BOLT = [
  K(0, 'lin', null),
  K(0.25, 'out', field(-0.15, 0.5, 0, 0, [-2.3, 0, 0.5], [-0.4, 0, -0.3], -0.3, 0.3, -0.4)),
  K(0.5, 'snap', field(0.22, -0.45, 0, -0.04, [-1.75, 0, -0.1], [-1.5, 0, -0.35], 0.4, -0.45, 0.35)),
  K(0.7, 'lin', field(0.2, -0.4, 0, -0.04, [-1.7, 0, -0.1], [-1.45, 0, -0.35], 0.4, -0.45, 0.35)),
  K(1, 'io', null),
];
// the nova: hands drawn to the chest, then flung wide, head back
const NOVA = [
  K(0, 'lin', null),
  K(0.3, 'out', field(0.25, 0, 0, -0.1, [-1.5, 0, -0.3], [-1.5, 0, 0.3], 0.3, 0.3, 0, 0.3)),
  K(0.52, 'snap', field(-0.2, 0, 0, 0.05, [-1.3, 0, 1.6], [-1.3, 0, -1.6], -0.4, 0.4, 0, -0.45)),
  K(0.75, 'lin', field(-0.15, 0, 0, 0.03, [-1.2, 0, 1.5], [-1.2, 0, -1.5], -0.4, 0.4, 0, -0.4)),
  K(1, 'io', null),
];
// the meteor: both hands raise the staff to the sky, then point it at the spot
const METEOR = [
  K(0, 'lin', null),
  K(0.35, 'out', field(-0.3, 0.2, 0, 0.04, [-3.1, 0, 0.2], [-2.9, 0, -0.2], -0.3, 0.3, 0, -0.6)),
  K(0.5, 'lin', field(-0.3, 0.2, 0, 0.04, [-3.1, 0, 0.2], [-2.9, 0, -0.2], -0.3, 0.3, 0, -0.6)),
  K(0.75, 'snap', field(0.3, -0.3, 0, -0.06, [-1.5, 0, 0.1], [-1.2, 0, -0.4], 0.4, -0.4, 0.2, 0.2)),
  K(1, 'io', null),
];

// ---------------------------------------------------------------- the hunter
// a shot: side-on, the bow arm out, the string hand drawn back to the cheek, then the release snaps
const DRAW = field(0.05, 0.55, 0, 0, [-1.5, 0, 0.75], [-1.6, 0.3, -0.1], -0.4, 0.35, -0.55);
const DRAWN = field(0.05, 0.6, 0, 0, [-1.75, 0, 1.3], [-1.65, 0.3, -0.1], -0.4, 0.35, -0.6);
const LOOSE = field(0.02, 0.5, 0, 0, [-1.3, 0, 1.7], [-1.55, 0.3, -0.05], -0.4, 0.35, -0.55);
const SHOT = [K(0, 'lin', null), K(0.18, 'out', DRAW), K(0.5, 'out', DRAWN), K(0.6, 'snap', LOOSE), K(0.75, 'lin', LOOSE), K(1, 'io', null)];
// the multishot: a wider draw, the bow swept across as the arrows fan out
const MULTI = [
  K(0, 'lin', null), K(0.2, 'out', { ...DRAW, by: 0.8 }), K(0.5, 'out', { ...DRAWN, by: 0.85 }),
  K(0.62, 'snap', { ...LOOSE, by: -0.2, hy: 0.1 }), K(0.78, 'lin', { ...LOOSE, by: -0.3, hy: 0.15 }), K(1, 'io', null),
];
// the arrow rain: the bow aimed at the sky, a lean back, the release
const RAIN = [
  K(0, 'lin', null),
  K(0.3, 'out', field(-0.35, 0.4, 0, 0, [-2.6, 0, 0.9], [-2.9, 0.2, -0.1], -0.3, 0.3, -0.3, -0.7)),
  K(0.55, 'out', field(-0.4, 0.45, 0, 0, [-2.8, 0, 1.3], [-3.0, 0.2, -0.1], -0.3, 0.3, -0.3, -0.75)),
  K(0.65, 'snap', field(-0.3, 0.4, 0, 0, [-2.3, 0, 1.7], [-2.9, 0.2, -0.05], -0.3, 0.3, -0.3, -0.6)),
  K(1, 'io', null),
];

const CASTS = { bolt: BOLT, nova: NOVA, meteor: METEOR, shot: SHOT, multi: MULTI, rain: RAIN };
// how far along the bow is drawn for a cast kind, for the string (0..1)
export function bowPull(kind, k) {
  if (kind === 'rain') return k < 0.55 ? Math.min(1, k / 0.5) : Math.max(0, 1 - (k - 0.55) / 0.1);
  return k < 0.5 ? Math.min(1, k / 0.45) : Math.max(0, 1 - (k - 0.5) / 0.1);
}

// lay the attack over the model. s: { swing, swingN, whirl, cast, castKind, slamAir, land, cls }
export function animAttack(root, s) {
  const u = root.userData, base = readPose(u);
  let pose = null;
  if (s.slamAir) pose = SLAM_AIR;
  else if (s.land >= 0 && s.land < 1) pose = sample(LAND, s.land, base);
  else if (s.swing >= 0) pose = s.whirl ? whirl(s.swing, base) : sample(s.swingN & 1 ? BACKHAND : SLASH, s.swing, base);
  else if (s.cast >= 0) pose = sample(CASTS[s.castKind] || (s.cls === 2 ? SHOT : BOLT), s.cast, base);
  if (pose) applyPose(u, pose);
  return !!pose;
}
