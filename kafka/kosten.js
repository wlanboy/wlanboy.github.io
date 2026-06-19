/* ============================================================
   Knative — Broker-Last-Visualisierung
   Vanilla JS, keine Frameworks.
   Zwei klickbare Diagramme mit Schritt-für-Schritt-Animation.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Szenario-Konfiguration ---------- */
  const NODES = {
    global: {
      layout: "cols",
      cols: {
        producers: [
          { id: "g-p1", cls: "is-producer", title: "Service A", sub: "Producer" },
          { id: "g-p2", cls: "is-producer", title: "Service B", sub: "Producer" },
          { id: "g-p3", cls: "is-producer", title: "Service C", sub: "Producer" },
        ],
        broker: [
          { id: "g-broker", cls: "is-broker", title: "Globaler Broker", sub: "1 Kafka-Topic · alle Events" },
        ],
        triggers: [
          { id: "g-t1", cls: "is-trigger", title: "Trigger A", sub: "Consumer-Group\nfilter: type=A" },
          { id: "g-t2", cls: "is-trigger", title: "Trigger B", sub: "Consumer-Group\nfilter: type=B" },
          { id: "g-t3", cls: "is-trigger", title: "Trigger C..Z", sub: "Consumer-Groups\nfilter: type=C..Z" },
        ],
        receivers: [
          { id: "g-r1", cls: "is-receiver", title: "Service A", sub: "Empfänger" },
          { id: "g-r2", cls: "is-receiver", title: "Service B", sub: "Empfänger" },
          { id: "g-r3", cls: "is-receiver", title: "Service C..Z", sub: "Empfänger" },
        ],
      },
      edges: [
        // producer -> broker (Kontext)
        { id: "e-p1b", from: "g-p1", to: "g-broker" },
        { id: "e-p2b", from: "g-p2", to: "g-broker" },
        { id: "e-p3b", from: "g-p3", to: "g-broker" },
        // broker -> trigger (Fan-out / die teuren Reads)
        { id: "e-bt1", from: "g-broker", to: "g-t1" },
        { id: "e-bt2", from: "g-broker", to: "g-t2" },
        { id: "e-bt3", from: "g-broker", to: "g-t3" },
        // trigger -> receiver
        { id: "e-t1r", from: "g-t1", to: "g-r1" },
        { id: "e-t2r", from: "g-t2", to: "g-r2" },
        { id: "e-t3r", from: "g-t3", to: "g-r3" },
      ],
    },
    decentral: {
      layout: "rows",
      rows: [
        [
          { id: "d-p1", cls: "is-producer", title: "Service A", sub: "Producer" },
          { id: "d-b1", cls: "is-broker", title: "Broker A", sub: "eigenes Topic" },
          { id: "d-t1", cls: "is-trigger", title: "Trigger A", sub: "Consumer-Group" },
          { id: "d-r1", cls: "is-receiver", title: "Service A", sub: "Empfänger" },
        ],
        [
          { id: "d-p2", cls: "is-producer", title: "Service B", sub: "Producer" },
          { id: "d-b2", cls: "is-broker", title: "Broker B", sub: "eigenes Topic" },
          { id: "d-t2", cls: "is-trigger", title: "Trigger B", sub: "Consumer-Group" },
          { id: "d-r2", cls: "is-receiver", title: "Service B", sub: "Empfänger" },
        ],
        [
          { id: "d-p3", cls: "is-producer", title: "Service C", sub: "Producer" },
          { id: "d-b3", cls: "is-broker", title: "Broker C", sub: "eigenes Topic" },
          { id: "d-t3", cls: "is-trigger", title: "Trigger C", sub: "Consumer-Group" },
          { id: "d-r3", cls: "is-receiver", title: "Service C", sub: "Empfänger" },
        ],
      ],
      edges: [
        { id: "e-d1pb", from: "d-p1", to: "d-b1" },
        { id: "e-d1bt", from: "d-b1", to: "d-t1" },
        { id: "e-d1tr", from: "d-t1", to: "d-r1" },
        { id: "e-d2pb", from: "d-p2", to: "d-b2" },
        { id: "e-d2bt", from: "d-b2", to: "d-t2" },
        { id: "e-d2tr", from: "d-t2", to: "d-r2" },
        { id: "e-d3pb", from: "d-p3", to: "d-b3" },
        { id: "e-d3bt", from: "d-b3", to: "d-t3" },
        { id: "e-d3tr", from: "d-t3", to: "d-r3" },
      ],
    },
  };

  /* ---------- Schritt-Definitionen ----------
     Jeder Schritt ist deterministisch: counters (kumulativ),
     nodeState (kumulativ), edge-Hervorhebung, caption, plus
     die beim Vorwärtsgehen abgespielte Animation.            */

  function makeGlobalSteps(n) {
    var nFmt = n.toLocaleString("de-DE");
    var dFmt = (n - 1).toLocaleString("de-DE");
    return [
      {
        count: { writes: 0, reads: 0, discarded: 0, delivered: 0 },
        dots: 0,
        label: "Start",
        caption: "Bereit. Klick auf „N\xe4chster Schritt“ oder direkt ins Diagramm, um den Weg eines einzelnen Events zu verfolgen.",
      },
      {
        count: { writes: 1, reads: 0, discarded: 0, delivered: 0 },
        dots: 1,
        label: "1 / 4 \xB7 Schreiben",
        nodes: { "g-p1": "active", "g-broker": "active" },
        edges: { "e-p1b": "active" },
        caption: "<strong>Schreiben.</strong> Service A schickt 1 Event an den globalen Broker. Der Java-Receiver schreibt es genau <strong>einmal</strong> ins gemeinsame Kafka-Topic.",
        anim: function(d) { d.fly("g-p1", "g-broker", { color: "blue" }); },
      },
      {
        count: { writes: 1, reads: n, discarded: 0, delivered: 0 },
        dots: 2,
        label: "2 / 4 \xB7 Lesen",
        nodes: { "g-broker": "active", "g-t1": "hot", "g-t2": "hot", "g-t3": "hot" },
        edges: { "e-bt1": "hot", "e-bt2": "hot", "e-bt3": "hot" },
        amp: "\xD7" + nFmt,
        caption: "<strong>Lesen (Fan-out).</strong> Jeder Trigger ist eine eigene Consumer-Group auf demselben Topic. Alle <strong>" + nFmt + "</strong> lesen das Event — aus 1 geschriebenen Event werden <strong>" + nFmt + " Reads</strong>. Diese Vervielf\xe4ltigung ist der teure Teil.",
        anim: function(d) {
          d.fly("g-broker", "g-t1", { color: "red", delay: 0 });
          d.fly("g-broker", "g-t2", { color: "red", delay: 130 });
          d.fly("g-broker", "g-t3", { color: "red", delay: 260 });
        },
      },
      {
        count: { writes: 1, reads: n, discarded: n - 1, delivered: 0 },
        dots: 3,
        label: "3 / 4 \xB7 Filtern",
        nodes: { "g-t1": "match", "g-t2": "discard", "g-t3": "discard", "g-r2": "dim", "g-r3": "dim", "e": "" },
        edges: { "e-bt1": "dim", "e-bt2": "dim", "e-bt3": "dim" },
        caption: "<strong>Filtern.</strong> Erst <strong>nach</strong> dem Lesen wertet der Java-Dispatcher jedes Triggers den Filter aus. Nur Trigger A passt; <strong>" + dFmt + "</strong> verwerfen das Event wieder — die Reads waren trotzdem n\xf6tig. <em>Verschwendete Arbeit.</em>",
      },
      {
        count: { writes: 1, reads: n, discarded: n - 1, delivered: 1 },
        dots: 4,
        label: "4 / 4 \xB7 Zustellen",
        nodes: { "g-t1": "match", "g-t2": "discard", "g-t3": "discard", "g-r1": "delivered", "g-r2": "dim", "g-r3": "dim" },
        edges: { "e-t1r": "deliver" },
        caption: "<strong>Zustellen.</strong> Nur 1 Event wird tats\xe4chlich zugestellt. <strong>Bilanz: 1 geschrieben \xB7 " + nFmt + " gelesen \xB7 " + dFmt + " verworfen \xB7 1 zugestellt.</strong> Die Kafka-Last skaliert mit der Zahl <em>aller</em> Trigger am Broker.",
        anim: function(d) { d.fly("g-t1", "g-r1", { color: "green" }); },
      },
    ];
  }

  const STEPS = {
    global: makeGlobalSteps(3),

    decentral: [
      {
        count: { writes: 0, reads: 0, discarded: 0, delivered: 0 },
        dots: 0,
        label: "Start",
        caption:
          'Bereit. Klick auf „Nächster Schritt" oder direkt ins Diagramm. Dasselbe Event, derselbe Weg — aber ein eigener Broker pro Service.',
        nodes: { "d-p2": "dim", "d-b2": "dim", "d-t2": "dim", "d-r2": "dim", "d-p3": "dim", "d-b3": "dim", "d-t3": "dim", "d-r3": "dim" },
        edges: { "e-d2pb": "dim", "e-d2bt": "dim", "e-d2tr": "dim", "e-d3pb": "dim", "e-d3bt": "dim", "e-d3tr": "dim" },
      },
      {
        count: { writes: 1, reads: 0, discarded: 0, delivered: 0 },
        dots: 1,
        label: "1 / 4 · Schreiben",
        nodes: { "d-p1": "active", "d-b1": "active", "d-p2": "dim", "d-b2": "dim", "d-t2": "dim", "d-r2": "dim", "d-p3": "dim", "d-b3": "dim", "d-t3": "dim", "d-r3": "dim" },
        edges: { "e-d1pb": "active", "e-d2pb": "dim", "e-d2bt": "dim", "e-d2tr": "dim", "e-d3pb": "dim", "e-d3bt": "dim", "e-d3tr": "dim" },
        caption:
          "<strong>Schreiben.</strong> Service A schickt sein Event an seinen <strong>eigenen</strong> Broker (eigenes Topic). Auch hier: genau einmal geschrieben.",
        anim: (d) => d.fly("d-p1", "d-b1", { color: "blue" }),
      },
      {
        count: { writes: 1, reads: 1, discarded: 0, delivered: 0 },
        dots: 2,
        label: "2 / 4 · Lesen",
        nodes: { "d-b1": "active", "d-t1": "active", "d-p2": "dim", "d-b2": "dim", "d-t2": "dim", "d-r2": "dim", "d-p3": "dim", "d-b3": "dim", "d-t3": "dim", "d-r3": "dim" },
        edges: { "e-d1bt": "active", "e-d2pb": "dim", "e-d2bt": "dim", "e-d2tr": "dim", "e-d3pb": "dim", "e-d3bt": "dim", "e-d3tr": "dim" },
        amp: "×1",
        caption:
          "<strong>Lesen.</strong> Nur die zuständige Consumer-Group von Trigger A hört auf diesem Topic. <strong>1 Read statt 3</strong> — keine fremden Trigger, keine Kopien. Broker B und C bleiben unberührt.",
        anim: (d) => d.fly("d-b1", "d-t1", { color: "blue" }),
      },
      {
        count: { writes: 1, reads: 1, discarded: 0, delivered: 0 },
        dots: 3,
        label: "3 / 4 · Filtern",
        nodes: { "d-t1": "match", "d-p2": "dim", "d-b2": "dim", "d-t2": "dim", "d-r2": "dim", "d-p3": "dim", "d-b3": "dim", "d-t3": "dim", "d-r3": "dim" },
        edges: { "e-d2pb": "dim", "e-d2bt": "dim", "e-d2tr": "dim", "e-d3pb": "dim", "e-d3bt": "dim", "e-d3tr": "dim" },
        caption:
          "<strong>Filtern.</strong> Der Filter läuft im Java-Dispatcher wie zuvor — aber es gibt <strong>nichts zu verwerfen</strong>. Das gelesene Event passt zum einzigen Trigger auf diesem Topic.",
      },
      {
        count: { writes: 1, reads: 1, discarded: 0, delivered: 1 },
        dots: 4,
        label: "4 / 4 · Zustellen",
        nodes: { "d-t1": "match", "d-r1": "delivered", "d-p2": "dim", "d-b2": "dim", "d-t2": "dim", "d-r2": "dim", "d-p3": "dim", "d-b3": "dim", "d-t3": "dim", "d-r3": "dim" },
        edges: { "e-d1tr": "deliver", "e-d2pb": "dim", "e-d2bt": "dim", "e-d2tr": "dim", "e-d3pb": "dim", "e-d3bt": "dim", "e-d3tr": "dim" },
        caption:
          "<strong>Zustellen.</strong> 1 Event zugestellt. <strong>Bilanz: 1 geschrieben · 1 gelesen · 0 verworfen · 1 zugestellt.</strong> Die Last bleibt lokal in der Domäne.",
        anim: (d) => d.fly("d-t1", "d-r1", { color: "green" }),
      },
    ],
  };

  const SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- Diagramm-Klasse ---------- */
  class Diagram {
    constructor(root, panel, scenario) {
      this.root = root;
      this.panel = panel;
      this.scenario = scenario;
      this.cfg = NODES[scenario];
      this.steps = STEPS[scenario];
      this.stage = root.querySelector(".stage");
      this.svg = root.querySelector(".edges");
      this.tokensLayer = root.querySelector(".tokens");
      this.ampEl = root.querySelector("[data-amp]");
      this.nodeEls = {};
      this.edgeEls = {};
      this.step = 0;
      this.timers = [];
      this.accumBase = { writes: 0, reads: 0, discarded: 0, delivered: 0 };
      this.isPlaying = false;
      this.autoPlayTimer = null;

      this.buildStage();
      this.buildEdges();
      this.bindPanel();

      // Klick ins Diagramm = weiter
      root.addEventListener("click", () => this.next());

      // Layout nach erstem Paint + bei Resize
      const relayout = () => this.positionEdges();
      if (window.ResizeObserver) {
        this.ro = new ResizeObserver(relayout);
        this.ro.observe(root);
      } else {
        window.addEventListener("resize", relayout);
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.positionEdges();
        this.applyStep(0, false);
      }));
    }

    buildStage() {
      const mk = (n) => {
        const el = document.createElement("div");
        el.className = "node " + n.cls;
        el.dataset.node = n.id;
        const sub = (n.sub || "").replace(/\n/g, "<br>");
        el.innerHTML = '<span class="n-title">' + n.title + "</span>" +
          (n.sub ? '<span class="n-sub">' + sub + "</span>" : "");
        this.nodeEls[n.id] = el;
        return el;
      };

      if (this.cfg.layout === "cols") {
        const wrap = document.createElement("div");
        wrap.className = "stage-cols";
        ["producers", "broker", "triggers", "receivers"].forEach((key) => {
          const col = document.createElement("div");
          col.className = "col col-" + key;
          this.cfg.cols[key].forEach((n) => col.appendChild(mk(n)));
          wrap.appendChild(col);
        });
        this.stage.appendChild(wrap);
      } else {
        const wrap = document.createElement("div");
        wrap.className = "stage-rows";
        this.cfg.rows.forEach((row) => row.forEach((n) => wrap.appendChild(mk(n))));
        this.stage.appendChild(wrap);
      }
    }

    buildEdges() {
      this.cfg.edges.forEach((e) => {
        const path = document.createElementNS(SVGNS, "path");
        path.setAttribute("class", "edge");
        path.dataset.edge = e.id;
        this.svg.appendChild(path);
        this.edgeEls[e.id] = path;
      });
    }

    anchor(id, side) {
      const el = this.nodeEls[id];
      const cr = this.root.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const y = r.top - cr.top + r.height / 2;
      const x = side === "right" ? r.right - cr.left : r.left - cr.left;
      return { x, y };
    }

    positionEdges() {
      const cr = this.root.getBoundingClientRect();
      this.svg.setAttribute("viewBox", "0 0 " + cr.width + " " + cr.height);
      this.svg.setAttribute("width", cr.width);
      this.svg.setAttribute("height", cr.height);
      this.cfg.edges.forEach((e) => {
        const a = this.anchor(e.from, "right");
        const b = this.anchor(e.to, "left");
        const dx = Math.max(28, (b.x - a.x) * 0.45);
        const d = "M " + a.x + " " + a.y +
          " C " + (a.x + dx) + " " + a.y + " " + (b.x - dx) + " " + b.y + " " + b.x + " " + b.y;
        this.edgeEls[e.id].setAttribute("d", d);
      });
    }

    /* Fliegendes Event-Token von Node A nach Node B */
    fly(fromId, toId, opts) {
      opts = opts || {};
      const a = this.anchor(fromId, "right");
      const b = this.anchor(toId, "left");
      const t = document.createElement("div");
      t.className = "token" + (opts.color === "red" ? " red" : opts.color === "green" ? " green" : "");
      t.style.left = a.x + "px";
      t.style.top = a.y + "px";
      const dur = this.isPlaying ? 320 : 720;
      if (this.isPlaying) t.style.transition = "transform " + dur + "ms cubic-bezier(.45,.05,.35,1)";
      this.tokensLayer.appendChild(t);
      const dx = b.x - a.x, dy = b.y - a.y;
      const delay = opts.delay || 0;
      this.timer(() => {
        t.style.transform = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px))";
      }, 30 + delay);
      this.timer(() => { t.classList.add("pulse"); }, 30 + delay + dur);
      this.timer(() => {
        t.style.transition = "opacity .2s";
        t.style.opacity = "0";
      }, 30 + delay + dur + 120);
      this.timer(() => { if (t.parentNode) t.remove(); }, 30 + delay + dur + 380);
    }

    timer(fn, ms) { this.timers.push(setTimeout(fn, ms)); }
    clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }
    clearTokens() { this.tokensLayer.innerHTML = ""; }

    bindPanel() {
      // Step-Dots aufbauen (4 Stück)
      const dotsWrap = this.panel.querySelector(".step-dots");
      this.dotEls = [];
      for (let i = 0; i < 4; i++) {
        const d = document.createElement("i");
        dotsWrap.appendChild(d);
        this.dotEls.push(d);
      }
      this.panel.querySelectorAll("[data-act]").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const act = btn.dataset.act;
          if (act === "next") this.next();
          else if (act === "prev") this.prev();
          else if (act === "reset") this.reset();
          else if (act === "auto") { if (this.isPlaying) this.stopAuto(); else this.startAuto(); }
        });
      });
      this.statEls = {};
      this.panel.querySelectorAll("[data-stat]").forEach((s) => {
        this.statEls[s.dataset.stat] = s;
      });
      this.captionEl = this.panel.querySelector("[data-caption]");
      this.stepCountEl = this.panel.querySelector("[data-stepcount]");
      this.playBtnEl = this.panel.querySelector('[data-act="auto"]');
    }

    next() { if (this.isPlaying) { this.stopAuto(); return; } if (this.step < this.steps.length - 1) this.applyStep(this.step + 1, true); }
    prev() { if (this.isPlaying) { this.stopAuto(); return; } if (this.step > 0) this.applyStep(this.step - 1, true); }
    reset() { this.stopAuto(); this.accumBase = { writes: 0, reads: 0, discarded: 0, delivered: 0 }; this.applyStep(0, false); }

    setTriggerCount(n) {
      this.stopAuto();
      this.accumBase = { writes: 0, reads: 0, discarded: 0, delivered: 0 };
      this.steps = makeGlobalSteps(n);
      // Update g-t3 sub-label to reflect how many triggers it represents
      var t3 = this.nodeEls["g-t3"];
      if (t3) {
        var sub = t3.querySelector(".n-sub");
        if (sub) {
          var extra = n > 3 ? (n - 2).toLocaleString("de-DE") + " Consumer-Groups" : "Consumer-Group";
          sub.innerHTML = extra + "<br>filter: type=C..Z";
        }
      }
      this.applyStep(0, false);
    }

    applyStep(n, animate) {
      this.clearTimers();
      this.clearTokens();
      this.step = n;

      // Kumulative Node-Zustände aus allen Schritten <= n sammeln
      const nodeState = {};
      const edgeState = {};
      for (let i = 0; i <= n; i++) {
        const s = this.steps[i];
        if (s.nodes) Object.keys(s.nodes).forEach((k) => { if (k !== "e") nodeState[k] = s.nodes[k]; });
      }
      // Edges nur vom aktuellen Schritt hervorheben (transient)
      const cur = this.steps[n];
      if (cur.edges) Object.assign(edgeState, cur.edges);

      // Nodes anwenden
      Object.keys(this.nodeEls).forEach((id) => {
        const el = this.nodeEls[id];
        el.classList.remove("active", "hot", "match", "discard", "delivered", "dim");
        if (nodeState[id]) el.classList.add(nodeState[id]);
      });

      // Edges anwenden
      Object.keys(this.edgeEls).forEach((id) => {
        const el = this.edgeEls[id];
        el.classList.remove("active", "hot", "deliver", "dim");
        if (edgeState[id]) el.classList.add(edgeState[id]);
      });

      // Counter
      this.setCounters(cur.count, animate);

      // Caption + Step-Label
      if (this.captionEl) this.captionEl.innerHTML = cur.caption;
      this.stepCountEl.textContent = cur.label;

      // Dots
      this.dotEls.forEach((d, i) => {
        d.classList.toggle("on", i < cur.dots);
        d.classList.toggle("red", this.scenario === "global" && i < cur.dots && cur.dots >= 2);
      });

      // Amplification-Badge
      if (cur.amp && this.scenario === "global") {
        this.ampEl.textContent = cur.amp;
        this.ampEl.classList.add("show");
      } else {
        this.ampEl.classList.remove("show");
      }

      // Buttons aktiv/inaktiv
      const prevBtn = this.panel.querySelector('[data-act="prev"]');
      const nextBtn = this.panel.querySelector('[data-act="next"]');
      if (prevBtn) prevBtn.disabled = this.isPlaying || n === 0;
      if (nextBtn) nextBtn.disabled = this.isPlaying || n === this.steps.length - 1;

      // Animation nur beim Vorwärtsgehen
      if (animate && cur.anim) {
        this.positionEdges();
        cur.anim(this);
      }
    }

    setCounters(count, animate) {
      Object.keys(count).forEach((key) => {
        const wrap = this.statEls[key];
        if (!wrap) return;
        const numEl = wrap.querySelector(".stat-num");
        const old = numEl.textContent;
        const total = count[key] + (this.accumBase[key] || 0);
        const val = total.toLocaleString("de-DE");
        numEl.textContent = val;
        if (animate && old !== val) {
          wrap.classList.remove("bump");
          void wrap.offsetWidth;
          wrap.classList.add("bump");
        }
      });
      const reads = this.statEls.reads;
      if (reads) reads.classList.toggle("alarm", (count.reads + (this.accumBase.reads || 0)) > 1);
    }

    startAuto() {
      if (this.isPlaying) return;
      this.isPlaying = true;
      this.updatePlayBtn();
      const delay = this.step === 0 ? 200 : 850;
      this.autoPlayTimer = setTimeout(() => this.autoTick(), delay);
    }

    stopAuto() {
      if (!this.isPlaying) return;
      this.isPlaying = false;
      if (this.autoPlayTimer) { clearTimeout(this.autoPlayTimer); this.autoPlayTimer = null; }
      this.clearTimers();
      this.updatePlayBtn();
      const prevBtn = this.panel.querySelector('[data-act="prev"]');
      const nextBtn = this.panel.querySelector('[data-act="next"]');
      if (prevBtn) prevBtn.disabled = this.step === 0;
      if (nextBtn) nextBtn.disabled = this.step === this.steps.length - 1;
    }

    autoTick() {
      if (!this.isPlaying) return;
      if (this.step < this.steps.length - 1) {
        this.applyStep(this.step + 1, true);
        this.autoPlayTimer = setTimeout(() => this.autoTick(), 850);
      } else {
        // Letzten Schritt anzeigen, Zähler akkumulieren, dann Schleife
        this.autoPlayTimer = setTimeout(() => {
          if (!this.isPlaying) return;
          const finalCount = this.steps[this.step].count;
          Object.keys(finalCount).forEach(k => {
            this.accumBase[k] = (this.accumBase[k] || 0) + finalCount[k];
          });
          this.applyStep(1, true);
          this.autoPlayTimer = setTimeout(() => this.autoTick(), 850);
        }, 1200);
      }
    }

    updatePlayBtn() {
      if (!this.playBtnEl) return;
      if (this.isPlaying) {
        this.playBtnEl.textContent = "◼ Stopp";
        this.playBtnEl.classList.add("is-playing");
      } else {
        this.playBtnEl.textContent = "► Abspielen";
        this.playBtnEl.classList.remove("is-playing");
      }
    }
  }

  /* ---------- Initialisierung ---------- */
  function init() {
    const diagrams = {};
    document.querySelectorAll(".diagram[data-scenario]").forEach((root) => {
      const scenario = root.dataset.scenario;
      const panel = document.querySelector('[data-panel="' + scenario + '"]');
      const diag = new Diagram(root, panel, scenario);
      root._diagram = diag;
      diagrams[scenario] = diag;
    });

    // Slider für Szenario 1
    const slider = document.getElementById("trigger-count");
    const valDisplay = document.getElementById("trigger-count-val");
    if (slider && valDisplay && diagrams.global) {
      slider.addEventListener("input", function() {
        const n = parseInt(slider.value, 10);
        valDisplay.textContent = n.toLocaleString("de-DE");
        diagrams.global.setTriggerCount(n);
      });
    }

    // Beim Drucken: beide Diagramme in den Endzustand
    window.addEventListener("beforeprint", () => {
      document.querySelectorAll(".diagram[data-scenario]").forEach((root) => {
        if (root._diagram) root._diagram.applyStep(root._diagram.steps.length - 1, false);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
