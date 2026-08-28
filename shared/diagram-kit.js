// Shared SVG diagram-building helpers used by istio/diagrams.js and knative/diagrams.js.
(function () {
  'use strict';

  const C = {
    bg: '#0b0b12', surf: '#111119', surf2: '#1c1c28', line: '#2d3148',
    ingress: '#3b82f6', routing: '#a855f7', policy: '#f59e0b',
    data: '#22c55e', security: '#e05c7a', external: '#22d3ee',
    dim: '#6b7280', txt: '#f1f5f9',
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  let _u = 0;

  function mksvg(w, h) {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', `0 0 ${w} ${h}`);
    s.setAttribute('width', '100%');
    Object.assign(s.style, { maxWidth: w + 'px', display: 'block', margin: '0 auto', overflow: 'visible' });
    return s;
  }

  function el(tag, a) {
    const n = document.createElementNS(SVGNS, tag);
    if (a) for (const [k, v] of Object.entries(a)) n.setAttribute(k, v);
    return n;
  }

  function mkm(colors) {
    const d = el('defs'), ids = {};
    for (const [nm, clr] of Object.entries(colors)) {
      const id = 'mk' + (++_u);
      ids[nm] = id;
      const m = el('marker', { id, markerWidth: 9, markerHeight: 7, refX: 8, refY: 3.5, orient: 'auto', markerUnits: 'userSpaceOnUse' });
      m.appendChild(el('polygon', { points: '0 0,9 3.5,0 7', fill: clr }));
      d.appendChild(m);
    }
    return [d, ids];
  }

  function rr(x, y, w, h, fill, stroke, rx, sw, dash) {
    const a = { x, y, width: w, height: h, rx: rx ?? 8, fill: fill ?? C.surf, stroke: stroke ?? C.line, 'stroke-width': sw ?? 1.5 };
    if (dash) a['stroke-dasharray'] = dash;
    return el('rect', a);
  }

  function tx(x, y, s, fill, sz, anch, bold, mono) {
    const n = el('text', {
      x, y, fill: fill ?? C.txt, 'font-size': sz ?? 12,
      'font-family': mono ? "'SF Mono','Fira Code',monospace" : "-apple-system,'Segoe UI',system-ui,sans-serif",
      'text-anchor': anch ?? 'middle', 'dominant-baseline': 'middle',
      'font-weight': bold ? '700' : 'normal',
    });
    n.textContent = s;
    return n;
  }

  function bx(p, x, y, w, h, label, sub, clr, dash) {
    p.appendChild(rr(x, y, w, h, clr ? clr + '1c' : C.surf, clr ?? C.line, 8, 1.5, dash));
    if (sub) {
      p.appendChild(tx(x + w / 2, y + h / 2 - 8, label, clr ?? C.txt, 11.5, 'middle', true));
      p.appendChild(tx(x + w / 2, y + h / 2 + 9, sub, C.dim, 9.5, 'middle', false, true));
    } else {
      p.appendChild(tx(x + w / 2, y + h / 2, label, clr ?? C.txt, 12, 'middle', true));
    }
  }

  function ar(p, x1, y1, x2, y2, mid, clr, dash) {
    const a = { x1, y1, x2, y2, stroke: clr ?? C.line, 'stroke-width': 1.5, 'marker-end': `url(#${mid})` };
    if (dash) a['stroke-dasharray'] = dash;
    p.appendChild(el('line', a));
  }

  function arp(p, d, mid, clr, dash) {
    const a = { d, fill: 'none', stroke: clr ?? C.line, 'stroke-width': 1.5, 'marker-end': `url(#${mid})` };
    if (dash) a['stroke-dasharray'] = dash;
    p.appendChild(el('path', a));
  }

  function ln(p, x1, y1, x2, y2, clr, sw, dash) {
    const a = { x1, y1, x2, y2, stroke: clr ?? C.line, 'stroke-width': sw ?? 1 };
    if (dash) a['stroke-dasharray'] = dash;
    p.appendChild(el('line', a));
  }

  function grp(p, x, y, w, h, label, clr, dash) {
    p.appendChild(rr(x, y, w, h, clr + '10', clr + '66', 10, 1.5, dash ?? '5 4'));
    p.appendChild(tx(x + 10, y + 14, label, clr, 9.5, 'start', true, true));
  }

  function pill(p, cx, cy, label, bg, fg) {
    const pw = label.length * 6.0 + 16, ph = 19;
    p.appendChild(rr(cx - pw / 2, cy - ph / 2, pw, ph, bg, bg, 9.5, 0));
    p.appendChild(tx(cx, cy, label, fg, 9.5, 'middle', true));
  }

  function frame(s, w, h) { s.appendChild(rr(0, 0, w, h, C.bg, 'none', 12)); }

  window.DiagramKit = { C, SVGNS, mksvg, el, mkm, rr, tx, bx, ar, arp, ln, grp, pill, frame };
})();
