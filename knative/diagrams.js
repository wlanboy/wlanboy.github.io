(function () {
  'use strict';

  const { C, mksvg, el, mkm, rr, tx, bx, ar, arp, ln, grp, pill, frame } = window.DiagramKit;

  // ── d1: Serving vs. Eventing – gemeinsames Fundament ─────────────
  function d1(cont) {
    const W = 800, H = 300;
    const s = mksvg(W, H);
    const [d] = mkm({});
    s.appendChild(d);
    frame(s, W, H);

    grp(s, 30, 20, 340, 170, 'KNATIVE SERVING', C.ingress);
    bx(s, 55, 60, 130, 46, 'Service (ksvc)', null, C.ingress);
    bx(s, 220, 60, 130, 46, 'Route', null, C.routing);
    bx(s, 55, 130, 130, 46, 'Configuration', null, C.policy);
    bx(s, 220, 130, 130, 46, 'Revision', null, C.data);

    grp(s, 430, 20, 340, 170, 'KNATIVE EVENTING', C.external);
    bx(s, 455, 60, 130, 46, 'Source', null, C.external);
    bx(s, 620, 60, 130, 46, 'Broker', null, C.routing);
    bx(s, 455, 130, 130, 46, 'Trigger', null, C.policy);
    bx(s, 620, 130, 130, 46, 'Sink', null, C.data);

    s.appendChild(rr(30, 235, 740, 44, C.surf2, C.line, 8));
    s.appendChild(tx(400, 257, 'Kubernetes + Envoy-basierte Networking-Layer (Kourier / Istio / Contour)', C.dim, 10.5, 'middle', false, true));
    ln(s, 200, 190, 200, 235, C.dim, 1, '3 3');
    ln(s, 600, 190, 600, 235, C.dim, 1, '3 3');

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d2: Service → Configuration → Revisions ──────────────────────
  function d2(cont) {
    const W = 780, H = 260;
    const s = mksvg(W, H);
    const [d, M] = mkm({ b: C.ingress, p: C.policy, g: C.data, r: C.routing });
    s.appendChild(d);
    frame(s, W, H);

    bx(s, 15, 96, 130, 68, 'Service', 'ksvc', C.ingress);
    ar(s, 145, 118, 195, 118, M.b, C.ingress);
    bx(s, 195, 84, 160, 40, 'Route', 'Traffic-Split', C.routing);
    ar(s, 145, 145, 195, 165, M.b, C.ingress);
    bx(s, 195, 145, 160, 40, 'Configuration', 'gewünschter Zustand', C.policy);

    ar(s, 355, 165, 410, 165, M.p, C.policy);
    s.appendChild(tx(382, 152, 'erzeugt', C.policy, 8.5, 'middle'));

    const revs = [
      { y: 30,  name: 'Revision v1', sub: 'archiviert' },
      { y: 100, name: 'Revision v2', sub: 'tag: current' },
      { y: 170, name: 'Revision v3', sub: 'tag: candidate' },
    ];
    revs.forEach(({ y, name, sub }) => {
      bx(s, 410, y, 170, 54, name, sub, C.data);
      arp(s, `M 355 104 H 380 V ${y + 27} H 410`, M.r, C.routing, '3 3');
    });

    s.appendChild(tx(495, 240, 'Route splittet Traffic zwischen aktuellen Revisions', C.dim, 9.5, 'middle', false, true));

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d3: Ingress Flow ──────────────────────────────────────────────
  function d3(cont) {
    const W = 950, H = 190;
    const s = mksvg(W, H);
    const [d, M] = mkm({ i: C.ingress, r: C.routing, g: C.data });
    s.appendChild(d);
    frame(s, W, H);

    bx(s, 15, 65, 110, 54, 'Externer User', null, C.dim);
    ar(s, 125, 92, 178, 92, M.i, C.ingress);
    s.appendChild(tx(151, 78, 'HTTPS', C.ingress, 9, 'middle', true));

    bx(s, 178, 47, 190, 90, 'Ingress (Kourier)', 'Envoy @ Cluster-Rand', C.ingress);
    s.appendChild(tx(273, 155, 'TLS-Termination + Host-Header', C.dim, 9, 'middle'));

    ar(s, 368, 92, 430, 92, M.r, C.routing);
    s.appendChild(tx(399, 78, 'Route', C.routing, 9, 'middle', true));

    bx(s, 430, 60, 150, 64, 'Route', 'match Host', C.routing);

    ar(s, 580, 92, 636, 92, M.g, C.data);
    bx(s, 636, 65, 120, 54, 'Revision', 'Service', C.data);

    ar(s, 756, 92, 800, 92, M.g, C.data);
    bx(s, 800, 47, 140, 90, 'Pod', 'queue-proxy + App', C.security);

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d4: Route – Canary Traffic Split ─────────────────────────────
  function d4(cont) {
    const W = 720, H = 220;
    const s = mksvg(W, H);
    const [d, M] = mkm({ r: C.routing, y: C.policy, g: C.data });
    s.appendChild(d);
    frame(s, W, H);

    bx(s, 15, 82, 110, 56, 'Request', 'shop.example.com', C.dim);
    ar(s, 125, 110, 190, 110, M.r, C.routing);
    bx(s, 190, 82, 170, 56, 'Route', 'traffic-split', C.routing);

    arp(s, 'M 360 100 H 420 V 40', M.y, C.policy);
    bx(s, 420, 14, 190, 52, 'Revision v1 (current)', 'weight 90%', C.policy);

    arp(s, 'M 360 120 H 420 V 154', M.g, C.data);
    bx(s, 420, 128, 190, 52, 'Revision v2 (candidate)', 'weight 10% · tag: candidate', C.data);

    s.appendChild(tx(515, 200, 'candidate zusätzlich direkt über eigene Tag-URL testbar', C.dim, 9.5, 'middle', false, true));

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d5: Cold Start vs. Warmer Pfad ────────────────────────────────
  function d5(cont) {
    const W = 920, H = 260;
    const s = mksvg(W, H);
    const [d, M] = mkm({ g: C.data, y: C.policy, r: C.security });
    s.appendChild(d);
    frame(s, W, H);

    s.appendChild(tx(20, 26, 'Warmer Pfad — Pods bereits aktiv', C.data, 10.5, 'start', true));
    bx(s, 20, 40, 120, 50, 'Route', null, C.routing);
    ar(s, 140, 65, 190, 65, M.g, C.data);
    bx(s, 190, 40, 160, 50, 'queue-proxy', 'meldet Concurrency', C.security);
    ar(s, 350, 65, 400, 65, M.g, C.data);
    bx(s, 400, 40, 150, 50, 'user-container', null, C.data);

    s.appendChild(tx(20, 128, 'Cold Path — 0 Pods vorhanden', C.policy, 10.5, 'start', true));
    bx(s, 20, 142, 120, 50, 'Route', null, C.routing);
    ar(s, 140, 167, 190, 167, M.y, C.policy);
    bx(s, 190, 142, 140, 50, 'Activator', 'puffert Request', C.policy);

    arp(s, 'M 260 192 V 220 H 470', M.y, C.policy);
    s.appendChild(tx(365, 236, 'signalisiert Bedarf > 0', C.policy, 9, 'middle', false, true));
    bx(s, 470, 194, 150, 50, 'Autoscaler (KPA)', 'skaliert 0 → 1+', C.policy);

    arp(s, 'M 620 219 H 660 V 167', M.g, C.data);
    bx(s, 660, 142, 150, 50, 'Pod', 'queue-proxy+App', C.data);
    arp(s, 'M 330 167 H 660', M.y, C.policy, '3 3');
    s.appendChild(tx(495, 155, 'gepufferter Request wird weitergeleitet', C.dim, 8.5, 'middle', false, true));

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d6: Broker & Trigger – Event-Fluss mit Filter & DLQ ──────────
  function d6(cont) {
    const W = 780, H = 370;
    const s = mksvg(W, H);
    const [d, M] = mkm({ b: C.routing, g: C.data, y: C.policy, s: C.security });
    s.appendChild(d);
    frame(s, W, H);

    bx(s, 15, 108, 130, 58, 'Producer', 'CloudEvent POST', C.external);
    ar(s, 145, 137, 195, 137, M.b, C.routing);
    bx(s, 195, 108, 170, 58, 'Broker', 'default', C.routing);

    arp(s, 'M 365 128 H 430 V 40', M.g, C.data);
    s.appendChild(tx(410, 60, 'type=order', C.data, 8.5, 'end', false, true));
    bx(s, 430, 14, 170, 52, 'Trigger A', 'filter: type=order', C.data);
    ar(s, 600, 40, 650, 40, M.g, C.data);
    bx(s, 650, 14, 115, 52, 'Sink A', 'ksvc', C.ingress);

    arp(s, 'M 365 148 H 430 V 234', M.y, C.policy);
    s.appendChild(tx(410, 216, 'type=payment', C.policy, 8.5, 'end', false, true));
    bx(s, 430, 208, 170, 52, 'Trigger B', 'filter: type=payment', C.policy);
    ar(s, 600, 234, 650, 234, M.y, C.policy);
    bx(s, 650, 208, 115, 52, 'Sink B', 'ksvc', C.ingress);

    arp(s, 'M 515 260 V 296', M.s, C.security, '4 3');
    s.appendChild(tx(525, 284, 'Retries erschöpft', C.security, 8, 'start', false, true));
    bx(s, 430, 296, 170, 46, 'Dead Letter Sink', 'nach delivery.retry', C.security);

    s.appendChild(tx(390, 350, 'Nicht passende Events werden vom jeweiligen Trigger verworfen', C.dim, 9.5, 'middle', false, true));

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d7: Source (rein) & Sink (raus) zu externen Systemen ─────────
  function d7(cont) {
    const W = 900, H = 260;
    const s = mksvg(W, H);
    const [d, M] = mkm({ e: C.external, r: C.routing, y: C.policy });
    s.appendChild(d);
    frame(s, W, H);

    grp(s, 15, 20, 230, 90, 'AUSSERHALB DES CLUSTERS', C.external, '6 4');
    bx(s, 35, 46, 190, 46, 'RabbitMQ (Partner)', 'externer Producer', C.external);
    ar(s, 130, 92, 130, 128, M.e, C.external);
    bx(s, 35, 128, 190, 46, 'RabbitmqSource', null, C.external);

    ar(s, 225, 151, 290, 151, M.r, C.routing);
    bx(s, 290, 126, 140, 50, 'Broker', 'default', C.routing);

    ar(s, 430, 151, 480, 151, M.y, C.policy);
    bx(s, 480, 126, 150, 50, 'Trigger', 'type=order.shipped', C.policy);

    ar(s, 630, 138, 690, 100, M.y, C.policy);
    s.appendChild(tx(625, 90, 'Sink:', C.dim, 9, 'end', false, true));
    s.appendChild(tx(625, 103, 'ksvc', C.dim, 9, 'end', false, true));
    bx(s, 690, 74, 130, 50, 'Order Service', 'ksvc', C.ingress);

    ar(s, 630, 164, 690, 202, M.y, C.policy);
    s.appendChild(tx(625, 214, 'Sink: URI', C.dim, 9, 'end', false, true));
    bx(s, 690, 178, 130, 50, 'Partner-Webhook', 'externe URI', C.external);

    s.appendChild(tx(450, 230, 'kein eigenes Egress Gateway nötig – Sink ist einfach eine URI', C.dim, 9.5, 'middle', false, true));

    cont.innerHTML = '';
    cont.appendChild(s);
  }

  // ── d8: Gesamtüberblick ───────────────────────────────────────────
  function d8(cont) {
    const W = 1080, H = 340;
    const s = mksvg(W, H);
    const [d, M] = mkm({ i: C.ingress, r: C.routing, g: C.data, y: C.policy, e: C.external });
    s.appendChild(d);
    frame(s, W, H);

    bx(s, 10, 148, 90, 50, 'User', null, C.dim);
    ar(s, 100, 173, 148, 173, M.i, C.ingress);
    pill(s, 124, 158, '1', C.ingress, '#fff');

    bx(s, 148, 128, 130, 90, 'Ingress', 'Kourier', C.ingress);
    ar(s, 278, 173, 320, 173, M.r, C.routing);
    pill(s, 299, 158, '2', C.routing, '#fff');

    grp(s, 320, 60, 220, 220, 'REVISION (AUTOSCALED)', C.data);
    bx(s, 340, 100, 80, 56, 'Route', null, C.routing);
    bx(s, 340, 190, 170, 60, 'Pod', 'queue-proxy+App', C.security);
    arp(s, 'M 380 156 V 190', M.g, C.data);
    arp(s, 'M 320 128 H 340', M.g, C.data, '3 3');

    ar(s, 540, 220, 592, 220, M.y, C.policy);
    pill(s, 566, 205, '3', C.policy, '#fff');
    s.appendChild(tx(566, 240, 'CloudEvent', C.policy, 9, 'middle', true));

    bx(s, 592, 194, 140, 52, 'Broker', null, C.routing);
    ar(s, 732, 220, 780, 220, M.y, C.policy);
    pill(s, 756, 205, '4', C.policy, '#fff');

    bx(s, 780, 194, 130, 52, 'Trigger', 'Filter', C.policy);
    ar(s, 910, 220, 960, 220, M.e, C.external);
    pill(s, 935, 205, '5', C.external, '#fff');

    grp(s, 960, 190, 115, 70, '', C.external, '6 4');
    bx(s, 970, 200, 95, 50, 'RabbitMQ', 'extern', C.external);

    s.appendChild(tx(540, 300, '1 Ingress-Termination · 2 Route-Matching · 3 Pod (Cold Start bei Bedarf) emittiert CloudEvent · 4 Broker/Trigger filtert · 5 Sink: externes RabbitMQ', C.dim, 9.5, 'middle', false, true));

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
