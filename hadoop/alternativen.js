const CRITERIA = [
  { id: "esxi",       label: "ESXi-tauglich",        weight: 1, desc: "Stabil auf langsamen, unzuverlässigen ESXi-VMs betreibbar" },
  { id: "noops",      label: "Wenig Knowhow",        weight: 1, desc: "Betrieb ohne tiefes Spezialwissen möglich — Standard-Linux-Kenntnisse reichen" },
  { id: "oss",        label: "OSS produktionsreif",  weight: 1, desc: "Die OpenSource-Version ist feature-vollständig — keine Enterprise-Lizenz für Kernfunktionen nötig" },
  { id: "docs",       label: "Community / Doku",     weight: 1, desc: "Aktive Community, gute Dokumentation, viele Betriebsbeispiele" },
  { id: "scale",      label: "Horizontal skalierbar",weight: 1, desc: "Scale-out durch Hinzufügen von Nodes — kein Scale-up (teurere Hardware) nötig" },
  { id: "net",        label: "Netzwerk-tolerant",    weight: 4, desc: "Kommt mit Netzwerkproblemen, hoher Latenz und Node-Ausfällen klar — kein Split-Brain" },
  { id: "smallfiles", label: "Kleine Dateien",       weight: 4, desc: "Effizient auch bei sehr vielen kleinen Dateien — kein Overhead pro Objekt/Inode" },
  { id: "metadata",   label: "Viele Metadaten",      weight: 4, desc: "Verteilte Metadatenverwaltung — kein einzelner Metadaten-Server als Flaschenhals" },
  { id: "posix",      label: "POSIX-Zugriff",        weight: 2, desc: "Als normales Dateisystem mountbar — bestehende Tools funktionieren ohne Anpassung" },
  { id: "standalone", label: "Standalone",           weight: 2, desc: "Läuft ohne externe Abhängigkeiten — benötigt keine weiteren Storage- oder Metadaten-Systeme" },
  { id: "erasure",   label: "Erasure Coding",       weight: 2, desc: "Eingebautes Erasure Coding — speichereffizientere Redundanz als 3×-Replikation (z.B. EC 8+3 = 1,375× statt 3×)" },
  { id: "backup",    label: "Snapshot / Backup",    weight: 2, desc: "Eingebaute Snapshot- oder Versionierungsfunktion — kein externes Backup-Tool für Basisfunktionen nötig" },
  { id: "quotas",    label: "Quotas",               weight: 1, desc: "Eingebaute Speicherquotas auf Verzeichnis-, Bucket- oder User-Ebene — keine externe Verwaltungsschicht nötig" },
  { id: "rolling",   label: "Rolling Upgrades",     weight: 2, desc: "Nodes können einzeln aktualisiert werden ohne Cluster-Downtime — kein Maintenance-Fenster nötig" },
  { id: "observ",    label: "Observability",         weight: 2, desc: "Eingebaute Prometheus-Metriken oder natives Monitoring — kein externer Exporter-Umbau für Basis-Metriken nötig" },
];

const ALTERNATIVES = [
  {
    id: "minio", name: "MinIO", hue: 140,
    desc: "S3-kompatibler Objektspeicher als Single Binary. Einfache Installation, Erasure Coding auf 4+ Nodes. ACHTUNG: MinIO hat die Lizenz auf AGPL-3.0 umgestellt — kommerzielle Nutzung ohne Enterprise-Vertrag ist rechtlich problematisch. Für viele Organisationen kein echter OpenSource-Einsatz mehr möglich.",
    scores: { esxi:1, noops:1, oss:0, docs:1, scale:1, net:0, smallfiles:0, metadata:0, posix:0, standalone:1, erasure:1, backup:1, quotas:1, rolling:1, observ:1 },
  },
  {
    id: "ceph", name: "Ceph", hue: 300,
    desc: "Umfassendstes Open-Source-Storage-System: Block (RBD), Object (RGW/S3), Filesystem (CephFS) in einem. Sehr hohe Betriebskomplexität — benötigt erfahrene Admins, stabile Netzwerke und dedizierte OSD-Nodes.",
    scores: { esxi:0, noops:0, oss:1, docs:1, scale:1, net:0, smallfiles:0, metadata:0, posix:1, standalone:1, erasure:1, backup:1, quotas:1, rolling:1, observ:1 },
  },
  {
    id: "ozone", name: "Apache Ozone", hue: 30,
    desc: "Der direkte HDFS-Nachfolger aus dem Hadoop-Projekt. Kein Single-NameNode-Flaschenhals mehr — der Ozone Manager (OM) verwaltet Metadaten verteilt via Raft. Bei vielen kleinen Dateien weiterhin limitiert. Erfordert Hadoop-Kenntnisse im Betrieb.",
    scores: { esxi:0, noops:0, oss:1, docs:1, scale:1, net:1, smallfiles:0, metadata:1, posix:0, standalone:1, erasure:1, backup:1, quotas:1, rolling:0, observ:1 },
  },
  {
    id: "seaweedfs", name: "SeaweedFS", hue: 50,
    desc: "Verteilter Objektspeicher in Go — designed für viele kleine Dateien. Trennt Metadaten (Master) von Daten (Volume Server). Einfacher Betrieb, S3-API und FUSE-Mount verfügbar. Aktive Community.",
    scores: { esxi:1, noops:1, oss:1, docs:1, scale:1, net:1, smallfiles:1, metadata:1, posix:1, standalone:1, erasure:1, backup:1, quotas:0, rolling:1, observ:1 },
  },
  {
    id: "glusterfs", name: "GlusterFS", hue: 200,
    desc: "Reifes verteiltes POSIX-Dateisystem, nativ in viele Linux-Distributionen integriert. Einfaches Brick-Konzept. Schwach bei sehr vielen kleinen Dateien und netzwerkinstabilen Umgebungen (Split-Brain-Risiko).",
    scores: { esxi:1, noops:1, oss:1, docs:1, scale:1, net:0, smallfiles:0, metadata:0, posix:1, standalone:1, erasure:1, backup:1, quotas:1, rolling:1, observ:0 },
  },
  {
    id: "juicefs", name: "JuiceFS", hue: 160,
    desc: "POSIX-Dateisystem das Metadaten (Redis/TiKV/MySQL) und Daten (MinIO/S3/etc.) trennt. Aggregiert kleine Dateien zu Chunks. Benötigt zwei Backend-Systeme — erhöhte Komplexität, aber elegante Architektur.",
    scores: { esxi:1, noops:0, oss:0, docs:1, scale:1, net:1, smallfiles:1, metadata:1, posix:1, standalone:0, erasure:0, backup:1, quotas:1, rolling:1, observ:1 },
  },
  {
    id: "moosefs", name: "MooseFS", hue: 80,
    desc: "Einfaches verteiltes POSIX-Dateisystem mit Master-Chunk-Client-Architektur. Community Edition ist voll funktionsfähig. Gut für mittlere Installationen. Master-Server bleibt Metadaten-Flaschenhals in der CE.",
    scores: { esxi:1, noops:1, oss:0, docs:1, scale:1, net:1, smallfiles:0, metadata:0, posix:1, standalone:1, erasure:1, backup:1, quotas:1, rolling:0, observ:0 },
  },
  {
    id: "lizardfs", name: "LizardFS", hue: 260,
    desc: "MooseFS-fork mit Multi-Master-Unterstützung und Erasure Coding. Binärkompatibel zu MooseFS. Kleinere Community als MooseFS, Entwicklungstempo hat nachgelassen. Gute Wahl wenn Multi-Master kritisch ist.",
    scores: { esxi:1, noops:1, oss:1, docs:0, scale:1, net:1, smallfiles:0, metadata:0, posix:1, standalone:1, erasure:1, backup:1, quotas:1, rolling:1, observ:0 },
  },
  {
    id: "beegfs", name: "BeeGFS", hue: 340,
    desc: "Paralleles HPC-Dateisystem mit verteilten Metadaten-Servern — kein Metadaten-Flaschenhals. Sehr hoher Durchsatz. Ausgelegt für schnelle, stabile Netzwerke. Community Edition kostenlos, Dokumentation gut.",
    scores: { esxi:1, noops:1, oss:1, docs:1, scale:1, net:0, smallfiles:0, metadata:1, posix:1, standalone:1, erasure:0, backup:0, quotas:1, rolling:0, observ:1 },
  },
  {
    id: "garage", name: "Garage", hue: 15,
    desc: "Leichtgewichtiger S3-kompatibler Objektspeicher in Rust — designed für geo-verteilte und netzwerkinstabile Umgebungen. Echter Community-OpenSource (AGPL), keine kommerzielle Einschränkung. Kein POSIX, aber S3-API stabil und gut dokumentiert.",
    scores: { esxi:1, noops:1, oss:1, docs:1, scale:1, net:1, smallfiles:0, metadata:0, posix:0, standalone:1, erasure:0, backup:0, quotas:0, rolling:1, observ:1 },
  },
  {
    id: "alluxio", name: "Alluxio", hue: 180,
    desc: "Virtuelles verteiltes Dateisystem als Caching-Schicht über beliebigen Storage-Backends (MinIO, Ceph, NFS, HDFS). Bietet HDFS-kompatible API für Migration. Kein primärer Speicher — setzt anderen Storage voraus.",
    scores: { esxi:0, noops:0, oss:1, docs:1, scale:1, net:1, smallfiles:0, metadata:0, posix:1, standalone:0, erasure:0, backup:0, quotas:0, rolling:0, observ:1 },
  },
];

const POSITIONS = {
  minio:    { x: 150, y: 180 },
  ceph:     { x: 350, y: 100 },
  ozone:    { x: 560, y: 120 },
  seaweedfs:{ x: 770, y: 170 },
  glusterfs:{ x: 920, y: 300 },
  juicefs:  { x: 800, y: 430 },
  moosefs:  { x: 580, y: 450 },
  lizardfs: { x: 360, y: 420 },
  beegfs:   { x: 180, y: 360 },
  garage:   { x: 650, y: 300 },
  alluxio:  { x: 480, y: 280 },
};

const NEUTRAL_R = 48;
const MIN_R     = 20;
const MAX_R     = 74;

let selectedCriteria = new Set();
let selectedAltId    = null;

function weightedScore(alt, selected) {
  let score = 0, max = 0;
  for (const id of selected) {
    const c = CRITERIA.find(c => c.id === id);
    const w = c?.weight ?? 1;
    max += w;
    if (alt.scores[id]) score += w;
    else score -= w;
  }
  return { score, max };
}

function getRadius(alt) {
  if (selectedCriteria.size === 0) return NEUTRAL_R;
  const { score, max } = weightedScore(alt, selectedCriteria);
  const ratio = (score + max) / (2 * max);
  return MIN_R + ratio * (MAX_R - MIN_R);
}

function bubbleColor(hue, alpha) {
  return `oklch(0.72 0.13 ${hue} / ${alpha})`;
}

function buildGrid() {
  const g = document.getElementById("grid-lines");
  const W = 1100, H = 550, step = 100;
  let html = "";
  for (let x = 0; x <= W; x += step)
    html += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="oklch(0.7 0.04 250)" stroke-width="0.5"/>`;
  for (let y = 0; y <= H; y += step)
    html += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="oklch(0.7 0.04 250)" stroke-width="0.5"/>`;
  g.innerHTML = html;
}

function buildBubbles() {
  const container = document.getElementById("bubbles");
  container.innerHTML = "";
  const ns = "http://www.w3.org/2000/svg";

  for (const alt of ALTERNATIVES) {
    const pos = POSITIONS[alt.id];

    const outer = document.createElementNS(ns, "g");
    outer.setAttribute("class", "bubble");
    outer.setAttribute("data-id", alt.id);
    outer.setAttribute("transform", `translate(${pos.x},${pos.y})`);

    const inner = document.createElementNS(ns, "g");
    inner.setAttribute("class", "bubble-inner");

    const glow = document.createElementNS(ns, "circle");
    glow.setAttribute("class", "bubble-glow");
    glow.setAttribute("r", String(NEUTRAL_R * 1.9));
    glow.setAttribute("fill", bubbleColor(alt.hue, 0.13));
    glow.setAttribute("filter", "url(#glow)");

    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("class", "bubble-bg");
    circle.setAttribute("r", String(NEUTRAL_R));
    circle.setAttribute("fill", bubbleColor(alt.hue, 0.22));
    circle.setAttribute("stroke", bubbleColor(alt.hue, 0.75));
    circle.setAttribute("stroke-width", "1.2");

    const label = document.createElementNS(ns, "text");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "central");
    label.setAttribute("fill", `oklch(0.95 0.08 ${alt.hue})`);
    label.setAttribute("font-family", "ui-monospace, monospace");
    label.setAttribute("font-size", "12");
    label.setAttribute("font-weight", "600");
    label.setAttribute("pointer-events", "none");
    label.setAttribute("letter-spacing", "0.5");
    label.textContent = alt.name;

    inner.appendChild(glow);
    inner.appendChild(circle);
    inner.appendChild(label);
    outer.appendChild(inner);

    outer.addEventListener("click", (e) => {
      e.stopPropagation();
      openDetail(alt.id);
    });

    container.appendChild(outer);
  }
}

function updateBubbles() {
  let bestAlt = null;
  let bestR   = -1;

  for (const alt of ALTERNATIVES) {
    const r = getRadius(alt);
    if (r > bestR) { bestR = r; bestAlt = alt; }
  }

  for (const outer of document.querySelectorAll(".bubble")) {
    const id  = outer.getAttribute("data-id");
    const alt = ALTERNATIVES.find(a => a.id === id);
    if (!alt) continue;

    const r      = getRadius(alt);
    const scale  = r / NEUTRAL_R;
    const isBest = selectedCriteria.size > 0 && alt === bestAlt;

    const { score, max } = weightedScore(alt, selectedCriteria);
    const ratio = selectedCriteria.size === 0 ? 1 : (score + max) / (2 * max);

    const inner  = outer.querySelector(".bubble-inner");
    const circle = outer.querySelector(".bubble-bg");
    const glow   = outer.querySelector(".bubble-glow");

    inner.style.transform = `scale(${scale})`;
    outer.style.opacity   = selectedCriteria.size === 0 ? "1" : String(Math.max(0.28, ratio));

    circle.setAttribute("stroke-width", isBest ? "2.5" : "1.2");
    circle.setAttribute("stroke", isBest
      ? `oklch(0.95 0.2 ${alt.hue})`
      : bubbleColor(alt.hue, 0.75));
    glow.setAttribute("fill", isBest
      ? bubbleColor(alt.hue, 0.28)
      : bubbleColor(alt.hue, 0.13));
  }

  updateStatus(bestAlt);
  if (selectedAltId) openDetail(selectedAltId);
}

function updateStatus(bestAlt) {
  const count = selectedCriteria.size;
  document.getElementById("tb-count").textContent =
    `${count} / ${CRITERIA.length} kriterien aktiv`;

  const sbLeft  = document.getElementById("sb-left");
  const sbRight = document.getElementById("sb-right");

  if (count === 0) {
    sbLeft.textContent  = "kriterien: keine ausgewählt";
    sbRight.textContent = "klick auf alternative für details";
    sbRight.className   = "hint";
    return;
  }

  sbLeft.textContent = [...selectedCriteria]
    .map(id => CRITERIA.find(c => c.id === id)?.label ?? id)
    .join(" · ");

  if (bestAlt) {
    const { score, max } = weightedScore(bestAlt, selectedCriteria);
    sbRight.textContent = `beste: ${bestAlt.name} · ${score}/${max} punkten`;
    sbRight.className   = "best";
  }
}

function openDetail(id) {
  selectedAltId = id;
  const alt = ALTERNATIVES.find(a => a.id === id);
  if (!alt) return;

  document.getElementById("detail-name").textContent = alt.name;
  document.getElementById("detail-desc").textContent = alt.desc;

  const scoresEl = document.getElementById("detail-scores");
  scoresEl.innerHTML = "";

  for (const c of CRITERIA) {
    const hit        = alt.scores[c.id] === 1;
    const isSelected = selectedCriteria.has(c.id);

    const row = document.createElement("div");
    row.className = ["score-row",
      hit ? "hit" : "miss",
      isSelected ? "selected-criterion" : ""
    ].join(" ").trim();

    const icon = document.createElement("span");
    icon.className   = "score-icon";
    icon.textContent = hit ? "+" : "−";
    icon.style.color = hit ? "oklch(0.82 0.17 140)" : "oklch(0.62 0.10 15)";

    const lbl = document.createElement("span");
    lbl.className   = "score-label";
    lbl.textContent = c.label;

    row.appendChild(icon);
    row.appendChild(lbl);
    scoresEl.appendChild(row);
  }

  const detail = document.getElementById("detail");
  detail.style.setProperty("--accent", `oklch(0.85 0.14 ${alt.hue})`);
  if (!detail.classList.contains("open")) {
    detail.classList.add("open");
  }
}

function buildPills() {
  const container = document.getElementById("pills");
  for (const c of CRITERIA) {
    const pill = document.createElement("button");
    pill.className   = c.weight > 1 ? "pill pill-heavy" : "pill";
    pill.textContent = c.weight > 1 ? `${c.label} ×2` : c.label;
    pill.title       = c.desc;
    pill.setAttribute("data-id", c.id);

    pill.addEventListener("click", () => {
      if (selectedCriteria.has(c.id)) {
        selectedCriteria.delete(c.id);
        pill.classList.remove("active");
      } else {
        selectedCriteria.add(c.id);
        pill.classList.add("active");
      }
      updateBubbles();
    });

    container.appendChild(pill);
  }
}

document.getElementById("detail-close").addEventListener("click", () => {
  document.getElementById("detail").classList.remove("open");
  selectedAltId = null;
});

document.getElementById("chart").addEventListener("click", () => {
  document.getElementById("detail").classList.remove("open");
  selectedAltId = null;
});

buildGrid();
buildPills();
buildBubbles();
updateBubbles();
