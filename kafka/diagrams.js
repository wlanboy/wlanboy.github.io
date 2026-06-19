(function () {
  'use strict';

  const C = {
    bg: '#0f1117', surf: '#1a1d27', line: '#2d3148',
    blue: '#5b6af0', red: '#e05c7a', grn: '#42c9a0',
    yel: '#f0a742', dim: '#565f89', txt: '#e2e4ef',
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

  function rr(x, y, w, h, fill, stroke, rx, sw) {
    return el('rect', { x, y, width: w, height: h, rx: rx ?? 8, fill: fill ?? C.surf, stroke: stroke ?? C.line, 'stroke-width': sw ?? 1.5 });
  }

  function tx(x, y, s, fill, sz, anch, bold, mono) {
    const n = el('text', {
      x, y, fill: fill ?? C.txt, 'font-size': sz ?? 12,
      'font-family': mono ? "'JetBrains Mono','Fira Code',monospace" : "'Segoe UI',system-ui,sans-serif",
      'text-anchor': anch ?? 'middle', 'dominant-baseline': 'middle',
      'font-weight': bold ? '700' : 'normal',
    });
    n.textContent = s;
    return n;
  }

  function bx(p, x, y, w, h, label, sub, clr) {
    p.appendChild(rr(x, y, w, h, clr ? clr + '22' : C.surf, clr ?? C.line));
    if (sub) {
      p.appendChild(tx(x + w / 2, y + h / 2 - 8, label, clr ?? C.txt, 11, 'middle', true));
      p.appendChild(tx(x + w / 2, y + h / 2 + 8, sub, C.dim, 9.5, 'middle', false, true));
    } else {
      p.appendChild(tx(x + w / 2, y + h / 2, label, clr ?? C.txt, 12, 'middle', true));
    }
  }

  function ar(p, x1, y1, x2, y2, mid, clr) {
    p.appendChild(el('line', { x1, y1, x2, y2, stroke: clr ?? C.line, 'stroke-width': 1.5, 'marker-end': `url(#${mid})` }));
  }

  function arp(p, d, mid, clr) {
    p.appendChild(el('path', { d, fill: 'none', stroke: clr ?? C.line, 'stroke-width': 1.5, 'marker-end': `url(#${mid})` }));
  }

  function ln(p, x1, y1, x2, y2, clr, sw) {
    p.appendChild(el('line', { x1, y1, x2, y2, stroke: clr ?? C.line, 'stroke-width': sw ?? 1 }));
  }

  function grp(p, x, y, w, h, label, clr) {
    p.appendChild(rr(x, y, w, h, clr + '15', clr + '55', 10, 1.5));
    p.appendChild(tx(x + 10, y + 13, label, clr, 9.5, 'start', true, true));
  }

  function pill(p, cx, cy, label, bg, fg) {
    const pw = label.length * 6.1 + 14, ph = 18;
    p.appendChild(rr(cx - pw / 2, cy - ph / 2, pw, ph, bg, bg, 9, 0));
    p.appendChild(tx(cx, cy, label, fg, 9.5, 'middle', true));
  }

  // ── d1: Event-Fluss Basis ──────────────────────────────────────
  function d1(cont) {
    const W = 620, H = 320;
    const s = mksvg(W, H);
    const [d, M] = mkm({ b: C.blue, g: C.grn, y: C.yel });
    s.appendChild(d);
    s.appendChild(rr(0, 0, W, H, C.bg, 'none', 12));

    bx(s, 220, 15, 180, 46, 'Produzent', null, C.yel);
    ar(s, 310, 61, 310, 108, M.b, C.blue);
    s.appendChild(tx(318, 84, 'HTTP POST / CloudEvent', C.dim, 9.5, 'start', false, true));
    bx(s, 175, 108, 270, 52, 'Broker', 'persistiert Events im Backend', C.blue);
    arp(s, 'M 280 160 V 186 H 148 V 212', M.g, C.grn);
    arp(s, 'M 340 160 V 186 H 472 V 212', M.g, C.grn);
    bx(s, 68, 212, 160, 44, 'Trigger A', 'type=order', C.grn);
    bx(s, 392, 212, 160, 44, 'Trigger B', 'type=payment', C.grn);
    ar(s, 148, 256, 148, 294, M.y, C.yel);
    ar(s, 472, 256, 472, 294, M.y, C.yel);
    bx(s, 68, 294, 160, 44, 'Service A', null, C.yel);
    bx(s, 392, 294, 160, 44, 'Service B', null, C.yel);

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d2: Naive Anti-Pattern ─────────────────────────────────────
  function d2(cont) {
    const W = 900, H = 420;
    const s = mksvg(W, H);
    const [d, M] = mkm({ r: C.red, g: C.grn, b: C.blue, y: C.yel });
    s.appendChild(d);
    s.appendChild(rr(0, 0, W, H, C.bg, 'none', 12));

    bx(s, 15, 186, 100, 76, 'Event Sources', null, C.yel);
    ar(s, 115, 224, 148, 224, M.r, C.red);
    bx(s, 148, 156, 175, 120, 'Globaler KNative Broker', 'Topic: "global-events"', C.red);

    const rows = [
      { y: 76,  ns: 'NS: alpha', clr: C.grn,  svcs: ['Svc-A1', 'Svc-A2'] },
      { y: 205, ns: 'NS: beta',  clr: C.blue,  svcs: ['Svc-B1'] },
      { y: 336, ns: 'NS: gamma', clr: C.yel,   svcs: ['Svc-G1', 'Svc-G2'] },
    ];
    const gbMid = 216;

    rows.forEach(({ y, ns, clr, svcs }) => {
      const nbh = svcs.length > 1 ? 72 : 50;
      const myc = y + nbh / 2;

      if (Math.abs(myc - gbMid) < 10) {
        ar(s, 323, gbMid, 450, myc, M.r, C.red);
        s.appendChild(tx(387, gbMid - 12, 'Trigger', C.red, 8.5, 'middle', false));
      } else {
        arp(s, `M 323 ${gbMid} H 380 V ${myc} H 450`, M.r, C.red);
        s.appendChild(tx(416, myc - 11, 'Trigger', C.red, 8.5, 'middle', false));
      }

      const nsn = ns.split(': ')[1];
      bx(s, 450, y + 2, 148, nbh - 4, 'KNative Broker', `Topic: "ns-${nsn}"`, clr);

      const svcX = 622, svcW = 96, svcH = 32;
      ar(s, 598, myc, svcX, myc, M.y, C.yel);
      svcs.forEach((name, i) => {
        const tot = svcs.length * svcH + (svcs.length - 1) * 6;
        const sy = myc - tot / 2 + i * (svcH + 6);
        bx(s, svcX, sy, svcW, svcH, name, null, C.yel);
      });
    });

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d5: Empfohlene Architektur ────────────────────────────────
  function d5(cont) {
    const W = 780, H = 310;
    const s = mksvg(W, H);
    const [d, M] = mkm({ b: C.blue, g: C.grn, y: C.yel });
    s.appendChild(d);
    s.appendChild(rr(0, 0, W, H, C.bg, 'none', 12));

    const rows = [
      { y: 58,  cg: 'cg-alpha', ns: 'NS: alpha', clr: C.grn  },
      { y: 132, cg: 'cg-beta',  ns: 'NS: beta',  clr: C.blue },
      { y: 206, cg: 'cg-gamma', ns: 'NS: gamma', clr: C.yel  },
    ];
    const RH = 46, spineX = 152;
    const topicY = 46, topicH = 218, topicMidY = topicY + topicH / 2;

    bx(s, 14, topicY, 118, topicH, 'global-events', 'Kafka Topic', C.blue);
    s.appendChild(tx(73, topicY + topicH + 14, '1× geschrieben', C.grn, 9, 'middle', true));

    const firstRC = rows[0].y + RH / 2;
    const lastRC  = rows[rows.length - 1].y + RH / 2;
    ln(s, spineX, firstRC, spineX, lastRC, C.blue, 1.5);
    ln(s, 132, topicMidY, spineX, topicMidY, C.blue, 1.5);

    rows.forEach(({ y, cg, ns, clr }) => {
      const rc = y + RH / 2;
      ar(s, spineX, rc, 172, rc, M.b, C.blue);
      bx(s, 172, y, 140, RH, 'KafkaSource', cg, clr);
      ar(s, 312, rc, 332, rc, M.b, clr);
      bx(s, 332, y, 128, RH, 'Broker', ns, clr);
      ar(s, 460, rc, 480, rc, M.g, C.grn);
      bx(s, 480, y, 78, RH, 'Trigger', null, C.grn);
      ar(s, 558, rc, 576, rc, M.y, C.yel);
      bx(s, 576, y, 122, RH, 'Service', null, C.yel);
    });

    s.appendChild(tx(242, topicY + topicH + 14, 'pro Namespace eine Consumer Group', C.dim, 9, 'middle', false));
    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d6: Filter Pipeline ────────────────────────────────────────
  function d6(cont) {
    const W = 820, H = 196;
    const s = mksvg(W, H);
    const [d, M] = mkm({ b: C.blue, y: C.yel });
    s.appendChild(d);
    s.appendChild(rr(0, 0, W, H, C.bg, 'none', 10));

    const items = [
      { x: 18,  w: 112, label: 'Kafka Topic',      sub: null,          clr: C.blue },
      { x: 164, w: 132, label: 'KafkaSource',       sub: null,          clr: C.blue },
      { x: 334, w: 152, label: 'Namespace Broker',  sub: null,          clr: C.blue },
      { x: 530, w: 108, label: 'Trigger',           sub: '▲ Filter',    clr: C.grn  },
      { x: 684, w: 120, label: 'Service',           sub: null,          clr: C.yel  },
    ];
    const bh = 52, by = 52;

    items.forEach(({ x, w, label, sub, clr }, i) => {
      bx(s, x, by, w, bh, label, sub, clr);
      if (i < items.length - 1) {
        ar(s, x + w, by + bh / 2, items[i + 1].x, by + bh / 2, M.b, C.blue);
      }
    });

    // Annotation lines and labels
    const f2cx = 584;
    ln(s, f2cx, by + bh, f2cx, 130, C.grn, 1);
    s.appendChild(tx(f2cx, 145, 'Exact-Match / CeSQl', C.grn, 9.5, 'middle', false, true));
    s.appendChild(tx(f2cx, 163, 'im Trigger-CRD', C.dim, 9, 'middle', false, true));
    s.appendChild(tx(f2cx, 181, 'Consumer-Side Filtering', C.dim, 8.5, 'middle', false, true));

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── Init ───────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    [['diag-1', d1], ['diag-2', d2], ['diag-5', d5], ['diag-6', d6]]
      .forEach(([id, fn]) => { const e = document.getElementById(id); if (e) fn(e); });
  });
})();
