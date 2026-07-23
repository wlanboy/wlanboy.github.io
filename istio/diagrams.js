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

  // ── d1: Sidecar Injection – Traffic Interception im Pod ─────────
  function d1(cont) {
    const W = 720, H = 340;
    const s = mksvg(W, H);
    const [d, M] = mkm({ b: C.security, g: C.data, p: C.routing });
    s.appendChild(d);
    frame(s, W, H);

    grp(s, 30, 70, 400, 220, 'POD — SHARED NETWORK NAMESPACE', C.dim);

    bx(s, 60, 150, 150, 70, 'App-Container', 'localhost:8080', C.data);
    bx(s, 280, 150, 130, 70, 'Envoy Sidecar', 'iptables-redirect', C.security);

    arp(s, 'M 210 172 H 280', M.b, C.security);
    s.appendChild(tx(245, 160, 'out', C.dim, 8.5, 'middle'));
    arp(s, 'M 280 208 H 210', M.g, C.data);
    s.appendChild(tx(245, 222, 'in', C.dim, 8.5, 'middle'));

    ar(s, 20, 185, 60, 185, M.b, C.security);
    s.appendChild(tx(15, 165, 'externer / interner', C.dim, 8.5, 'end'));
    s.appendChild(tx(15, 178, 'Traffic (inbound)', C.dim, 8.5, 'end'));
    ar(s, 410, 185, 460, 185, M.g, C.data);
    s.appendChild(tx(465, 178, 'ausgehender', C.dim, 8.5, 'start'));
    s.appendChild(tx(465, 191, 'Traffic (outbound)', C.dim, 8.5, 'start'));

    s.appendChild(tx(245, 130, 'iptables NAT: Port 15006 (in) / 15001 (out)', C.dim, 9, 'middle', false, true));

    bx(s, 490, 20, 190, 56, 'istiod', 'Control Plane', C.routing);
    arp(s, 'M 490 60 C 420 60, 400 100, 345 150', M.p, C.routing, '4 3');
    s.appendChild(tx(470, 100, 'xDS Config +', C.routing, 9, 'middle', false, true));
    s.appendChild(tx(470, 113, 'mTLS-Zertifikate (gRPC)', C.routing, 9, 'middle', false, true));

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d2: Ingress Gateway Flow ─────────────────────────────────────
  function d2(cont) {
    const W = 900, H = 190;
    const s = mksvg(W, H);
    const [d, M] = mkm({ i: C.ingress, r: C.routing, g: C.data });
    s.appendChild(d);
    frame(s, W, H);

    bx(s, 15, 65, 110, 54, 'Externer User', null, C.dim);
    ar(s, 125, 92, 178, 92, M.i, C.ingress);
    s.appendChild(tx(151, 78, 'HTTPS', C.ingress, 9, 'middle', true));

    bx(s, 178, 47, 190, 90, 'Ingress Gateway', 'Envoy @ Mesh-Rand', C.ingress);
    s.appendChild(tx(273, 155, 'TLS-Termination', C.dim, 9, 'middle'));

    ar(s, 368, 92, 430, 92, M.r, C.routing);
    s.appendChild(tx(399, 78, 'Route', C.routing, 9, 'middle', true));

    bx(s, 430, 60, 150, 64, 'VirtualService', 'match Host/Pfad', C.routing);

    ar(s, 580, 92, 636, 92, M.g, C.data);
    bx(s, 636, 65, 120, 54, 'Service', 'ClusterIP', C.data);

    ar(s, 756, 92, 800, 92, M.g, C.data);
    bx(s, 800, 47, 85, 90, 'Pod', 'Sidecar+App', C.security);

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d3: VirtualService – Canary Routing ──────────────────────────
  function d3(cont) {
    const W = 760, H = 260;
    const s = mksvg(W, H);
    const [d, M] = mkm({ r: C.routing, g: C.data, y: C.policy });
    s.appendChild(d);
    frame(s, W, H);

    bx(s, 15, 96, 110, 50, 'Request', 'x-canary: true?', C.dim);
    ar(s, 125, 121, 190, 121, M.r, C.routing);

    bx(s, 190, 76, 200, 96, 'VirtualService', 'match → route', C.routing);

    arp(s, 'M 390 100 H 440 V 40', M.g, C.data);
    s.appendChild(tx(430, 60, 'match: header', C.data, 9, 'end', false, true));
    bx(s, 440, 14, 160, 52, 'Subset v2', 'x-canary=true → 100%', C.data);

    arp(s, 'M 390 142 H 440 V 130', M.y, C.policy);
    s.appendChild(tx(430, 148, 'default: 90 / 10', C.policy, 9, 'end', false, true));
    bx(s, 440, 104, 160, 46, 'Subset v1', 'weight 90%', C.policy);
    bx(s, 440, 168, 160, 46, 'Subset v2', 'weight 10%', C.data);

    s.appendChild(tx(600, 235, 'Subset-Namen werden über DestinationRule aufgelöst →', C.dim, 9.5, 'middle', false, true));

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d4: DestinationRule – Subsets & Load Balancing ───────────────
  function d4(cont) {
    const W = 760, H = 280;
    const s = mksvg(W, H);
    const [d, M] = mkm({ y: C.policy, g: C.data });
    s.appendChild(d);
    frame(s, W, H);

    bx(s, 15, 108, 150, 58, 'subset: v1', 'aus VirtualService', C.routing);
    ar(s, 165, 137, 220, 137, M.y, C.policy);

    bx(s, 220, 96, 190, 82, 'DestinationRule', 'labels: version=v1', C.policy);
    s.appendChild(tx(315, 200, 'loadBalancer: LEAST_REQUEST', C.dim, 9, 'middle', false, true));
    s.appendChild(tx(315, 214, 'tls.mode: ISTIO_MUTUAL', C.dim, 9, 'middle', false, true));

    const podY = [30, 118, 206];
    podY.forEach((y) => {
      arp(s, `M 410 137 H 470 V ${y + 27} H 500`, M.g, C.data);
    });
    podY.forEach((y, i) => {
      bx(s, 500, y, 160, 54, `Pod v1-${i + 1}`, 'Envoy + App', C.data);
    });

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d5: Service & Sidecar – kompletter Aufruf-Pfad ───────────────
  function d5(cont) {
    const W = 940, H = 210;
    const s = mksvg(W, H);
    const [d, M] = mkm({ b: C.security, g: C.data, r: C.routing });
    s.appendChild(d);
    frame(s, W, H);

    const items = [
      { x: 10,  w: 110, label: 'App A',           sub: 'http-Client',  clr: C.data },
      { x: 148, w: 130, label: 'iptables',         sub: 'Redirect',     clr: C.dim  },
      { x: 306, w: 140, label: 'Sidecar A',        sub: 'outbound',     clr: C.security },
      { x: 474, w: 120, label: 'Service',          sub: 'DNS/VIP',      clr: C.data, dash: '4 3' },
      { x: 622, w: 140, label: 'Sidecar B',        sub: 'inbound',      clr: C.security },
      { x: 790, w: 140, label: 'App B',            sub: 'Handler',      clr: C.data },
    ];
    const bh = 58, by = 74;

    items.forEach(({ x, w, label, sub, clr, dash }, i) => {
      bx(s, x, by, w, bh, label, sub, clr, dash);
      if (i < items.length - 1) {
        ar(s, x + w, by + bh / 2, items[i + 1].x, by + bh / 2, M.b, C.security);
      }
    });

    s.appendChild(tx(534, by + bh + 22, 'mTLS', C.security, 10, 'middle', true));
    ln(s, 306, by + bh + 10, 762, by + bh + 10, C.security, 1, '4 3');

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d6: Service-zu-Service (Ost-West) ────────────────────────────
  function d6(cont) {
    const W = 780, H = 260;
    const s = mksvg(W, H);
    const [d, M] = mkm({ b: C.security, g: C.data });
    s.appendChild(d);
    frame(s, W, H);

    grp(s, 20, 40, 320, 160, 'MICROSERVICE A — POD', C.data);
    bx(s, 45, 90, 120, 60, 'App A', null, C.data);
    bx(s, 200, 90, 120, 60, 'Sidecar A', 'outbound', C.security);
    arp(s, 'M 165 120 H 200', M.g, C.data);

    grp(s, 440, 40, 320, 160, 'MICROSERVICE B — POD', C.data);
    bx(s, 460, 90, 120, 60, 'Sidecar B', 'inbound', C.security);
    bx(s, 615, 90, 120, 60, 'App B', null, C.data);
    arp(s, 'M 580 120 H 615', M.g, C.data);

    arp(s, 'M 320 120 H 460', M.b, C.security);
    s.appendChild(tx(390, 105, 'mTLS', C.security, 10.5, 'middle', true));
    s.appendChild(tx(390, 230, 'gegenseitige Authentifizierung per SPIFFE-Zertifikat (von istiod ausgestellt)', C.dim, 9.5, 'middle', false, true));

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d7: Egress Gateway – Weg zu externem RabbitMQ ────────────────
  function d7(cont) {
    const W = 900, H = 280;
    const s = mksvg(W, H);
    const [d, M] = mkm({ b: C.security, y: C.policy, e: C.external });
    s.appendChild(d);
    frame(s, W, H);

    grp(s, 15, 30, 260, 160, 'MICROSERVICE — POD', C.data);
    bx(s, 35, 80, 100, 60, 'App', null, C.data);
    bx(s, 165, 80, 90, 60, 'Sidecar', 'outbound', C.security);
    arp(s, 'M 135 110 H 165', M.b, C.security);

    ar(s, 255, 110, 330, 110, M.b, C.security);
    s.appendChild(tx(292, 96, 'mTLS', C.security, 9, 'middle', true));

    bx(s, 330, 78, 190, 64, 'Egress Gateway', 'Envoy @ Mesh-Rand', C.policy);
    s.appendChild(tx(425, 165, 'einziger Pfad nach außen', C.dim, 9, 'middle', false, true));
    s.appendChild(tx(425, 178, '(TLS-Origination, Audit-Log)', C.dim, 9, 'middle', false, true));

    ar(s, 520, 110, 590, 110, M.y, C.policy);
    s.appendChild(tx(555, 96, 'TLS', C.policy, 9, 'middle', true));

    grp(s, 590, 60, 290, 120, 'AUSSERHALB DES MESH', C.external, '6 4');
    bx(s, 615, 82, 240, 64, 'RabbitMQ', 'rabbitmq.partner.example.com : 5671', C.external);

    arp(s, 'M 210 140 V 220 H 660 V 146', M.b, C.security, '4 3');
    s.appendChild(tx(430, 236, 'Alternative A: direkter Egress ohne Gateway (ServiceEntry only)', C.dim, 9.5, 'middle', false, true));

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d8: Gesamtüberblick ───────────────────────────────────────────
  function d8(cont) {
    const W = 1080, H = 340;
    const s = mksvg(W, H);
    const [d, M] = mkm({ i: C.ingress, r: C.routing, g: C.data, b: C.security, y: C.policy, e: C.external });
    s.appendChild(d);
    frame(s, W, H);

    bx(s, 10, 148, 90, 50, 'User', null, C.dim);
    ar(s, 100, 173, 148, 173, M.i, C.ingress);
    pill(s, 124, 158, '1', C.ingress, '#fff');

    bx(s, 148, 128, 130, 90, 'Ingress GW', 'TLS + Route', C.ingress);
    ar(s, 278, 173, 320, 173, M.r, C.routing);
    pill(s, 299, 158, '2', C.routing, '#fff');

    grp(s, 320, 60, 220, 220, 'MICROSERVICE A', C.data);
    bx(s, 340, 100, 80, 56, 'Service A', null, C.data);
    bx(s, 340, 190, 170, 60, 'App A', 'Sidecar A', C.security);
    arp(s, 'M 380 156 V 190', M.g, C.data);
    arp(s, 'M 320 128 H 340', M.g, C.data, '3 3');

    ar(s, 540, 173, 592, 173, M.b, C.security);
    pill(s, 566, 158, '3', C.security, '#fff');
    s.appendChild(tx(566, 195, 'mTLS', C.security, 9, 'middle', true));

    grp(s, 592, 60, 220, 220, 'MICROSERVICE B', C.data);
    bx(s, 612, 190, 170, 60, 'App B', 'Sidecar B', C.security);
    bx(s, 700, 100, 80, 56, 'Service B', null, C.data);
    arp(s, 'M 697 190 V 156', M.g, C.data);

    ar(s, 782, 220, 834, 220, M.y, C.policy);
    pill(s, 808, 205, '4', C.policy, '#fff');

    bx(s, 834, 194, 130, 52, 'Egress GW', null, C.policy);
    ar(s, 964, 220, 1010, 220, M.e, C.external);
    pill(s, 987, 205, '5', C.external, '#fff');

    grp(s, 1010, 190, 65, 70, '', C.external, '6 4');
    bx(s, 1015, 200, 55, 50, 'MQ', 'extern', C.external);

    s.appendChild(tx(540, 300, '1 Ingress-Termination · 2 L7-Routing (VirtualService) · 3 Service-zu-Service mTLS · 4 Egress-Routing · 5 externes RabbitMQ', C.dim, 9.5, 'middle', false, true));

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── Init ───────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    [
      ['diag-1', d1], ['diag-2', d2], ['diag-3', d3], ['diag-4', d4],
      ['diag-5', d5], ['diag-6', d6], ['diag-7', d7], ['diag-8', d8],
    ].forEach(([id, fn]) => { const e = document.getElementById(id); if (e) fn(e); });
  });
})();
