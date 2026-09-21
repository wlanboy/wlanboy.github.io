(function () {
  const NS = "http://www.w3.org/2000/svg";
  const DATA = window.CONSTELLATIONS || [];
  const CROSS = window.CROSS_EDGES || [];

  function starColor(hue, mag) {
    const L = mag === 1 ? 0.93 : mag === 2 ? 0.80 : 0.64;
    const C = mag === 1 ? 0.14 : mag === 2 ? 0.12 : 0.09;
    return `oklch(${L} ${C} ${hue})`;
  }
  function hash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h; }
  function jitter(id, spread) { return ((hash(id) >>> 0) % 1000) / 1000 * spread - spread / 2; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // Keep the always-on radial label short enough to never outrun its card at any orbit angle;
  // the full name is always available in the detail panel and as an accessible label.
  function truncateLabel(label) { return label.length > 17 ? label.slice(0, 16) + '…' : label; }
  function starById(id) {
    for (const c of DATA) { const s = c.stars.find(s => s.id === id); if (s) return { star: s, cluster: c }; }
    return null;
  }

  const RING_R = { 1: 50, 2: 88, 3: 124 };
  const GOLDEN_ANGLE = 137.50776;
  const PLANET_R = { 1: 6.5, 2: 5, 3: 3.8 };
  // degrees/sec, signed for direction; slow ambient drift so labels stay legible
  const RING_SPEED = { 1: 360 / 150, 2: -(360 / 230), 3: 360 / 360 };

  const grid = document.getElementById('grid');
  const detail = document.getElementById('detail');
  const detailBody = document.getElementById('detailBody');
  const beamLayer = document.getElementById('beamLayer');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let totalStars = 0;
  DATA.forEach(c => totalStars += c.stars.length);
  document.getElementById('stats').textContent =
    `${DATA.length} systeme · ${totalStars} nodes · ${CROSS.length} cross-links`;

  // ---- background dust ----
  (function dust() {
    const svg = document.getElementById('dust');
    let seed = 1337;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 10000) / 10000; }
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 130; i++) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', (rnd() * 100) + '%');
      c.setAttribute('cy', (rnd() * 100) + '%');
      c.setAttribute('r', (rnd() * 1 + 0.3).toFixed(2));
      c.setAttribute('fill', 'oklch(0.85 0.02 250)');
      c.setAttribute('opacity', (rnd() * 0.5 + 0.08).toFixed(2));
      frag.appendChild(c);
    }
    svg.appendChild(frag);
  })();

  // ---- build systems ----
  const systems = [];

  DATA.forEach(c => {
    const wrap = document.createElement('div');
    wrap.className = 'system';
    wrap.style.setProperty('--hue', c.hue);

    const sys = { id: c.id, el: wrap, hue: c.hue, elapsed: 0, frozen: false, pinned: false, rings: { 1: [], 2: [], 3: [] } };

    // Golden-angle distribution across ALL stars in the system (not per-ring) so
    // labels on different rings never cluster at similar angles and collide.
    const clusterPhase = (hash(c.id) >>> 0) % 360;
    let ringsMarkup = '';
    c.stars.forEach((s, i) => {
      const m = s.mag;
      const baseAngle = (i * GOLDEN_ANGLE + clusterPhase) % 360 + jitter(s.id, 6);
      ringsMarkup += `<g class="planet" data-id="${s.id}" tabindex="0" role="button" aria-label="${esc(s.label)}">
        <circle class="planet-hit" r="11"/>
        <circle class="planet-core" r="${PLANET_R[m]}" style="fill:${starColor(c.hue, m)}"/>
        <text class="planet-label">${esc(truncateLabel(s.label))}</text>
      </g>`;
      sys.rings[m].push({ baseAngle, r: RING_R[m], star: s });
    });

    wrap.innerHTML = `
      <svg class="orbit-svg" viewBox="-220 -220 440 440" overflow="visible">
        <defs>
          <radialGradient id="glow-${c.id}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="oklch(0.95 0.06 ${c.hue})"/>
            <stop offset="45%" stop-color="oklch(0.8 0.16 ${c.hue} / 0.5)"/>
            <stop offset="100%" stop-color="oklch(0.8 0.16 ${c.hue} / 0)"/>
          </radialGradient>
        </defs>
        <circle class="ring-guide" r="${RING_R[1]}"/>
        <circle class="ring-guide" r="${RING_R[2]}"/>
        <circle class="ring-guide" r="${RING_R[3]}"/>
        <circle class="sun-glow" r="60" fill="url(#glow-${c.id})"/>
        <circle class="sun" r="20"/>
        ${ringsMarkup}
      </svg>
      <div class="system-label"><span class="cat">${esc(c.catalog)}</span><span class="name">${esc(c.name)}</span></div>
      <div class="system-hint">hover · klick</div>
    `;
    grid.appendChild(wrap);

    // wire up live element refs by id (DOM order follows c.stars, not ring grouping)
    const planetEls = wrap.querySelectorAll('.planet');
    [1, 2, 3].forEach(m => {
      sys.rings[m].forEach(entry => {
        const g = wrap.querySelector(`.planet[data-id="${entry.star.id}"]`);
        entry.hitEl = g.querySelector('.planet-hit');
        entry.circleEl = g.querySelector('.planet-core');
        entry.labelEl = g.querySelector('.planet-label');
      });
    });

    wrap.addEventListener('mouseenter', () => { sys.frozen = true; });
    wrap.addEventListener('mouseleave', () => { if (!sys.pinned) sys.frozen = false; });

    planetEls.forEach(pEl => {
      const activate = () => selectStar(pEl.dataset.id, wrap, sys);
      pEl.addEventListener('click', activate);
      pEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
    });

    systems.push(sys);
  });

  // Position via CSS transform (compositor-friendly) instead of cx/cy/x/y attributes,
  // which force the SVG engine to recompute geometry every frame. text-anchor only
  // gets written when the label actually flips sides, not every frame.
  function layoutSystem(sys) {
    [1, 2, 3].forEach(m => {
      const speed = RING_SPEED[m];
      sys.rings[m].forEach(p => {
        const angle = (p.baseAngle + sys.elapsed * speed) * Math.PI / 180;
        const x = Math.cos(angle) * p.r, y = Math.sin(angle) * p.r;
        const tf = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px)`;
        p.hitEl.style.transform = tf;
        p.circleEl.style.transform = tf;
        const lr = p.r + 11;
        const lx = Math.cos(angle) * lr, ly = Math.sin(angle) * lr;
        p.labelEl.style.transform = `translate(${lx.toFixed(2)}px,${ly.toFixed(2)}px)`;
        const anchor = lx >= 0 ? 'start' : 'end';
        if (p.lastAnchor !== anchor) { p.labelEl.setAttribute('text-anchor', anchor); p.lastAnchor = anchor; }
      });
    });
  }

  // ---- animation loop ----
  let lastT = performance.now();
  function tick(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    systems.forEach(sys => {
      if (sys.frozen) return; // frozen systems already show their last computed frame
      sys.elapsed += dt;
      layoutSystem(sys);
    });
    requestAnimationFrame(tick);
  }
  if (reduceMotion) {
    // draw once at rest positions, still using the same math with elapsed = 0
    systems.forEach(layoutSystem);
  } else {
    requestAnimationFrame(tick);
  }

  // ---- selection / detail panel ----
  let pinnedSystem = null;
  let selectedPlanetEl = null;

  function selectStar(id, systemEl, sys) {
    if (pinnedSystem && pinnedSystem.sys !== sys) { pinnedSystem.sys.pinned = false; pinnedSystem.sys.frozen = pinnedSystem.el.matches(':hover'); }
    sys.pinned = true; sys.frozen = true;
    pinnedSystem = { el: systemEl, sys };

    if (selectedPlanetEl) selectedPlanetEl.classList.remove('selected');
    selectedPlanetEl = systemEl.querySelector(`.planet[data-id="${id}"]`);
    if (selectedPlanetEl) selectedPlanetEl.classList.add('selected');

    const found = starById(id);
    if (!found) return;
    const { star, cluster } = found;

    const intra = new Set();
    cluster.lines.forEach(([a, b]) => { if (a === id) intra.add(b); else if (b === id) intra.add(a); });
    const intraStars = [...intra].map(sid => cluster.stars.find(s => s.id === sid)).filter(Boolean);

    const crossOut = CROSS.filter(e => e.from === id || e.to === id).map(e => {
      const otherId = e.from === id ? e.to : e.from;
      const other = starById(otherId);
      return { edge: e, other, otherId };
    }).filter(x => x.other);

    detailBody.innerHTML = `
      <div style="--hue:${cluster.hue}">
        <div class="d-cat">${esc(cluster.catalog)} · ${esc(cluster.name)}</div>
        <div class="d-name">${esc(star.label)}</div>
        <div class="d-meta">mag ${star.mag} · id ${esc(star.id)}</div>
        <div class="d-sec">
          <div class="d-h">Beschreibung</div>
          <div class="d-desc">${esc(star.desc || '')}</div>
        </div>
        <div class="d-sec">
          <div class="d-h">Im System verbunden</div>
          ${intraStars.length ? `<ul class="pills">${intraStars.map(s => `<li>${esc(s.label)}</li>`).join('')}</ul>` : '<div class="d-empty">keine</div>'}
        </div>
        <div class="d-sec">
          <div class="d-h">Cross-Domain</div>
          ${crossOut.length ? `<ul class="xlist">${crossOut.map(x => `
            <li data-target="${esc(x.otherId)}">
              <div class="xrel">${esc(x.edge.label)}</div>
              <div class="xtgt"><span class="xdot" style="background:oklch(0.85 0.12 ${x.other.cluster.hue})"></span>${esc(x.other.star.label)} <span style="opacity:.5">· ${esc(x.other.cluster.name)}</span></div>
            </li>`).join('')}</ul>` : '<div class="d-empty">keine</div>'}
        </div>
      </div>
    `;
    detail.classList.add('open');

    detailBody.querySelectorAll('.xlist li').forEach(li => {
      li.addEventListener('click', () => {
        const targetId = li.dataset.target;
        const targetEl = document.querySelector(`.planet[data-id="${targetId}"] .planet-core`);
        const sourceEl = selectedPlanetEl?.querySelector('.planet-core');
        if (targetEl && sourceEl) fireBeam(sourceEl, targetEl, cluster.hue);
      });
    });
  }

  document.getElementById('closeDetail').addEventListener('click', closeDetail);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
  function closeDetail() {
    detail.classList.remove('open');
    if (pinnedSystem) { pinnedSystem.sys.pinned = false; pinnedSystem.sys.frozen = pinnedSystem.el.matches(':hover'); pinnedSystem = null; }
    if (selectedPlanetEl) { selectedPlanetEl.classList.remove('selected'); selectedPlanetEl = null; }
  }

  function fireBeam(fromEl, toEl, hue) {
    beamLayer.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('class', 'beam-path');
    path.style.setProperty('--hue', hue);
    beamLayer.appendChild(path);
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('class', 'beam-dot');
    dot.setAttribute('r', '4');
    dot.style.setProperty('--hue', hue);
    beamLayer.appendChild(dot);

    const targetSystem = toEl.closest('.system');
    const targetPlanet = toEl.closest('.planet');
    targetSystem?.classList.add('pulse-target');
    targetPlanet?.classList.add('pulse-planet');
    setTimeout(() => { targetSystem?.classList.remove('pulse-target'); targetPlanet?.classList.remove('pulse-planet'); }, 1600);

    const start = performance.now();
    const dur = reduceMotion ? 1 : 1400;
    function frame(t) {
      const rf = fromEl.getBoundingClientRect();
      const rt = toEl.getBoundingClientRect();
      const x1 = rf.left + rf.width / 2, y1 = rf.top + rf.height / 2;
      const x2 = rt.left + rt.width / 2, y2 = rt.top + rt.height / 2;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const bow = Math.min(90, len * 0.16);
      const cx = mx + nx * bow, cy = my + ny * bow;
      path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
      const elapsed = t - start;
      const prog = Math.min(1, elapsed / dur);
      const total = path.getTotalLength();
      const pt = path.getPointAtLength(total * prog);
      dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
      const fadeOut = elapsed > dur ? Math.max(0, 1 - (elapsed - dur) / 500) : 1;
      path.style.opacity = fadeOut; dot.style.opacity = fadeOut;
      if (elapsed < dur + 500) requestAnimationFrame(frame);
      else { path.remove(); dot.remove(); }
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => {
    beamLayer.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
  });
})();
