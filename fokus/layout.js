// Force-directed auto layout for constellations.
// Each constellation gets an independent simulation inside an ellipse allocated by a coarse packing.

(function () {
  const DEFAULT_W = 1600;
  const DEFAULT_H = 1000;

  function seedRng(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = t;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Pack constellation centers by dividing the canvas into a grid sized for the count.
  function packCenters(constellations, viewW = DEFAULT_W, viewH = DEFAULT_H) {
    const n = constellations.length;
    const portrait = viewH > viewW * 1.1;
    const cols = portrait ? Math.ceil(n / Math.ceil(Math.sqrt(n))) : Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const cellW = viewW / cols;
    const cellH = viewH / rows;
    const out = {};
    constellations.forEach((c, i) => {
      const cx = (i % cols + 0.5) * cellW;
      const cy = (Math.floor(i / cols) + 0.5) * cellH;
      out[c.id] = {
        cx, cy,
        rx: cellW * 0.42,
        ry: cellH * 0.42,
      };
    });
    return out;
  }

  // Force-directed layout for a single constellation.
  // - Repulsion between all stars (keeps labels readable)
  // - Attraction along edges (pulls connected stars together)
  // - Gravity toward constellation center
  // - Elliptical soft boundary
  function simulate(stars, lines, center, opts = {}) {
    const iters    = opts.iters    ?? 260;
    const repel    = opts.repel    ?? 6000;
    const spring   = opts.spring   ?? 0.015;
    const springL  = opts.springL  ?? 110;
    const gravity  = opts.gravity  ?? 0.008;
    const damping  = opts.damping  ?? 0.85;
    const boundary = opts.boundary ?? 0.04;

    const rng = seedRng(stars.length * 31 + 7);
    // init positions on a ring around center (stable-ish given seed)
    const p = stars.map((s, i) => {
      const a = (i / stars.length) * Math.PI * 2 + rng() * 0.3;
      const r = Math.min(center.rx, center.ry) * 0.55;
      return {
        id: s.id,
        mag: s.mag,
        x: center.cx + Math.cos(a) * r + (rng() - 0.5) * 10,
        y: center.cy + Math.sin(a) * r + (rng() - 0.5) * 10,
        vx: 0, vy: 0,
      };
    });
    const idx = Object.fromEntries(p.map((s, i) => [s.id, i]));

    for (let t = 0; t < iters; t++) {
      // repulsion
      for (let i = 0; i < p.length; i++) {
        for (let j = i + 1; j < p.length; j++) {
          const dx = p[j].x - p[i].x;
          const dy = p[j].y - p[i].y;
          const d2 = dx * dx + dy * dy + 0.01;
          const d = Math.sqrt(d2);
          const f = repel / d2;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          p[i].vx -= fx; p[i].vy -= fy;
          p[j].vx += fx; p[j].vy += fy;
        }
      }
      // springs
      for (const [a, b] of lines) {
        const ia = idx[a], ib = idx[b];
        if (ia == null || ib == null) continue;
        const dx = p[ib].x - p[ia].x;
        const dy = p[ib].y - p[ia].y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const f = spring * (d - springL);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        p[ia].vx += fx; p[ia].vy += fy;
        p[ib].vx -= fx; p[ib].vy -= fy;
      }
      // gravity toward center
      for (const s of p) {
        s.vx += (center.cx - s.x) * gravity;
        s.vy += (center.cy - s.y) * gravity;
      }
      // integrate + damping + soft ellipse boundary
      for (const s of p) {
        s.vx *= damping; s.vy *= damping;
        s.x += s.vx; s.y += s.vy;
        const nx = (s.x - center.cx) / center.rx;
        const ny = (s.y - center.cy) / center.ry;
        const r = Math.sqrt(nx * nx + ny * ny);
        if (r > 1) {
          const pull = boundary * (r - 1);
          s.vx -= (s.x - center.cx) * pull;
          s.vy -= (s.y - center.cy) * pull;
        }
      }
    }
    return p;
  }

  // Compute an auto-layout layer for a whole constellation set.
  // Returns { [starId]: {x, y} } and updated constellation centers.
  function computeAutoLayout(constellations, viewW = DEFAULT_W, viewH = DEFAULT_H) {
    const centers = packCenters(constellations, viewW, viewH);
    const positions = {};
    const newCenters = {};
    for (const c of constellations) {
      const center = centers[c.id];
      const result = simulate(c.stars, c.lines, center, c.opts || {});
      for (const s of result) positions[s.id] = { x: s.x, y: s.y };
      // recompute centroid for label placement
      const avgX = result.reduce((a, s) => a + s.x, 0) / result.length;
      const avgY = result.reduce((a, s) => a + s.y, 0) / result.length;
      newCenters[c.id] = { cx: avgX, cy: avgY };
    }
    return { positions, centers: newCenters };
  }

  window.AutoLayout = { computeAutoLayout };
})();
