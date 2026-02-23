'use strict';

// Group color palettes  [dark-fill, dark-stroke, node-color,  light-fill,              light-stroke, light-node]
const GROUP_PALETTE = {
  jvm:    { fill: 'rgba(29,78,216,0.10)',   stroke: '#3b82f6', node: '#2563eb', lfill: 'rgba(219,234,254,0.45)', lstroke: '#2563eb', lnode: '#1d4ed8' },
  argocd: { fill: 'rgba(4,120,87,0.10)',    stroke: '#10b981', node: '#059669', lfill: 'rgba(209,250,229,0.45)', lstroke: '#059669', lnode: '#047857' },
  mcp:    { fill: 'rgba(109,40,217,0.10)',  stroke: '#8b5cf6', node: '#7c3aed', lfill: 'rgba(237,233,254,0.45)', lstroke: '#7c3aed', lnode: '#6d28d9' }
};

const NODE_R      = 30;
const GROUP_R_SM  = 118;   // ≤10 nodes
const GROUP_R_LG  = 148;   // >10 nodes
const BLOB_PAD    = 28;    // extra space around outermost nodes

let groups = [], topics = [], crossConnections = [];
let selectedId = null;
let svgW = 0, svgH = 0;

// ─── Initialise ─────────────────────────────────────────────────────────────

async function init() {
  if (localStorage.getItem('theme') === 'light') document.body.classList.add('light');
  document.getElementById('toggleTheme').addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
    updateStyles();
  });

  const data  = await fetch('focus.json').then(r => r.json());
  groups       = data.groups;
  topics       = data.topics;
  crossConnections = data.crossConnections || [];

  // Compute positions for every node (circular within its group)
  groups.forEach(g => {
    const members = topics.filter(t => t.group === g.id);
    const r = members.length <= 10 ? GROUP_R_SM : GROUP_R_LG;
    g.nodeRadius = r;
    g.blobRx     = r + NODE_R + BLOB_PAD;
    g.blobRy     = r + NODE_R + BLOB_PAD;
    members.forEach((t, i) => {
      const angle = (2 * Math.PI * i / members.length) - Math.PI / 2;
      t.x = g.cx + r * Math.cos(angle);
      t.y = g.cy + r * Math.sin(angle);
    });
  });

  const svg = document.getElementById('graph');
  svgW = svg.clientWidth;
  svgH = svg.clientHeight;

  render();

  // Background click → deselect
  svg.addEventListener('click', e => {
    if (e.target.tagName === 'svg' || e.target.id === 'graph-layer') deselect();
  });
  document.getElementById('detail-close').addEventListener('click', deselect);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') deselect(); });
  window.addEventListener('resize', () => {
    svgW = svg.clientWidth;
    svgH = svg.clientHeight;
    selectedId ? centerOn(topics.find(t => t.id === selectedId)) : resetView();
  });
}

// ─── Render ─────────────────────────────────────────────────────────────────

function render() {
  const layer = document.getElementById('graph-layer');
  layer.innerHTML = '';

  drawBlobs(layer);
  drawEdges(layer);
  drawNodes(layer);

  resetView();
  updateStyles();
}

function drawBlobs(layer) {
  groups.forEach(g => {
    const el = svgEl('ellipse');
    el.setAttribute('cx', g.cx);
    el.setAttribute('cy', g.cy);
    el.setAttribute('rx', g.blobRx);
    el.setAttribute('ry', g.blobRy);
    el.classList.add('blob');
    el.dataset.group = g.id;
    layer.appendChild(el);

    const txt = svgEl('text');
    txt.setAttribute('x', g.cx);
    txt.setAttribute('y', g.cy - g.blobRy + 22);
    txt.setAttribute('text-anchor', 'middle');
    txt.classList.add('group-label');
    txt.dataset.group = g.id;
    txt.textContent = g.label;
    layer.appendChild(txt);
  });
}

function drawEdges(layer) {
  // Intra-group edges (deduplicated)
  const drawn = new Set();
  topics.forEach(t => {
    (t.connections || []).forEach(cid => {
      const key = [t.id, cid].sort().join('|');
      if (drawn.has(key)) return;
      drawn.add(key);
      const target = topics.find(x => x.id === cid);
      if (!target) return;
      const line = svgEl('line');
      line.setAttribute('x1', t.x);
      line.setAttribute('y1', t.y);
      line.setAttribute('x2', target.x);
      line.setAttribute('y2', target.y);
      line.classList.add('edge', 'edge-intra');
      line.dataset.a = t.id;
      line.dataset.b = cid;
      layer.appendChild(line);
    });
  });

  // Cross-group edges (dashed)
  crossConnections.forEach(cc => {
    const src = topics.find(t => t.id === cc.from);
    const tgt = topics.find(t => t.id === cc.to);
    if (!src || !tgt) return;
    const line = svgEl('line');
    line.setAttribute('x1', src.x);
    line.setAttribute('y1', src.y);
    line.setAttribute('x2', tgt.x);
    line.setAttribute('y2', tgt.y);
    line.classList.add('edge', 'edge-cross');
    line.dataset.a = cc.from;
    line.dataset.b = cc.to;
    layer.appendChild(line);
  });
}

function drawNodes(layer) {
  topics.forEach(t => {
    const g = svgEl('g');
    g.classList.add('node');
    g.dataset.id    = t.id;
    g.dataset.group = t.group;

    const circle = svgEl('circle');
    circle.setAttribute('cx', t.x);
    circle.setAttribute('cy', t.y);
    circle.setAttribute('r',  NODE_R);
    g.appendChild(circle);

    appendLabel(g, t.label, t.x, t.y);

    g.addEventListener('click', e => {
      e.stopPropagation();
      selectedId === t.id ? deselect() : selectNode(t.id);
    });
    layer.appendChild(g);
  });
}

function appendLabel(g, label, cx, cy) {
  const words = label.split(' ');
  const text  = svgEl('text');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');

  if (words.length === 1) {
    text.setAttribute('x', cx);
    text.setAttribute('y', cy);
    text.textContent = label;
  } else {
    text.setAttribute('x', cx);
    text.setAttribute('y', cy);
    const half = Math.ceil(words.length / 2);
    const s1   = svgEl('tspan');
    s1.setAttribute('x', cx);
    s1.setAttribute('dy', '-0.65em');
    s1.textContent = words.slice(0, half).join(' ');
    const s2   = svgEl('tspan');
    s2.setAttribute('x', cx);
    s2.setAttribute('dy', '1.3em');
    s2.textContent = words.slice(half).join(' ');
    text.appendChild(s1);
    text.appendChild(s2);
  }
  g.appendChild(text);
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function updateStyles() {
  const isLight = document.body.classList.contains('light');

  // Reset all
  document.querySelectorAll('.node').forEach(n => n.classList.remove('dim', 'selected', 'connected'));
  document.querySelectorAll('.edge').forEach(e => e.classList.remove('dim', 'active'));
  document.querySelectorAll('.blob').forEach(b => b.classList.remove('dim'));
  document.querySelectorAll('.group-label').forEach(l => l.classList.remove('dim'));

  // Apply group colours to blobs, labels and node circles
  groups.forEach(g => {
    const pal    = GROUP_PALETTE[g.id] || GROUP_PALETTE.mcp;
    const fill   = isLight ? pal.lfill   : pal.fill;
    const stroke = isLight ? pal.lstroke : pal.stroke;
    const nodeC  = isLight ? pal.lnode   : pal.node;

    document.querySelectorAll(`.blob[data-group="${g.id}"]`).forEach(b => {
      b.style.fill   = fill;
      b.style.stroke = stroke;
    });
    document.querySelectorAll(`.group-label[data-group="${g.id}"]`).forEach(lbl => {
      lbl.style.fill = stroke;
    });
    document.querySelectorAll(`.node[data-group="${g.id}"] circle`).forEach(c => {
      c.style.stroke = nodeC;
      c.style.fill   = '';   // reset any selection highlight
    });
  });

  if (!selectedId) return;

  const sel     = topics.find(t => t.id === selectedId);
  const connSet = new Set(sel.connections || []);
  crossConnections.forEach(cc => {
    if (cc.from === selectedId) connSet.add(cc.to);
    if (cc.to   === selectedId) connSet.add(cc.from);
  });

  document.querySelectorAll('.node').forEach(n => {
    if      (n.dataset.id === selectedId)  n.classList.add('selected');
    else if (connSet.has(n.dataset.id))    n.classList.add('connected');
    else                                    n.classList.add('dim');
  });

  document.querySelectorAll('.edge').forEach(e => {
    const active = e.dataset.a === selectedId || e.dataset.b === selectedId;
    active ? e.classList.add('active') : e.classList.add('dim');
  });

  // Dim other groups' blobs and labels
  document.querySelectorAll('.blob').forEach(b => {
    if (b.dataset.group !== sel.group) b.classList.add('dim');
  });
  document.querySelectorAll('.group-label').forEach(lbl => {
    if (lbl.dataset.group !== sel.group) lbl.classList.add('dim');
  });

  // Highlight selected node with group accent fill
  const pal     = GROUP_PALETTE[sel.group] || GROUP_PALETTE.mcp;
  const accent  = isLight ? pal.lnode : pal.node;
  const selCirc = document.querySelector(`.node[data-id="${selectedId}"] circle`);
  if (selCirc) {
    selCirc.style.fill   = accent;
    selCirc.style.stroke = accent;
  }

  // Propagate accent colour to detail panel
  document.getElementById('detail-title').style.color = accent;
}

// ─── Selection ──────────────────────────────────────────────────────────────

function selectNode(id) {
  selectedId = id;
  const topic = topics.find(t => t.id === id);
  updateStyles();
  centerOn(topic);
  showDetail(topic);
}

function deselect() {
  selectedId = null;
  updateStyles();
  resetView();
  document.getElementById('detail').classList.add('hidden');
}

function centerOn(topic) {
  const layer = document.getElementById('graph-layer');
  layer.style.transform = `translate(${svgW / 2 - topic.x}px, ${svgH / 2 - topic.y - 85}px)`;
}

function resetView() {
  const layer = document.getElementById('graph-layer');
  layer.style.transform = `translate(${svgW / 2}px, ${svgH / 2 - 20}px)`;
}

// ─── Detail Panel ────────────────────────────────────────────────────────────

function showDetail(topic) {
  const group = groups.find(g => g.id === topic.group);

  document.getElementById('detail-title').textContent = topic.label;
  document.getElementById('detail-desc').textContent  = topic.description;

  const linksDiv = document.getElementById('detail-links');
  linksDiv.innerHTML = '';

  // Group badge
  if (group) {
    const pal    = GROUP_PALETTE[group.id] || GROUP_PALETTE.mcp;
    const isLight = document.body.classList.contains('light');
    const accent  = isLight ? pal.lnode : pal.node;
    const badge   = document.createElement('span');
    badge.classList.add('group-badge');
    badge.textContent        = group.label;
    badge.style.borderColor  = accent;
    badge.style.color        = accent;
    linksDiv.appendChild(badge);
  }

  // Connected nodes
  const connIds = new Set(topic.connections || []);
  crossConnections.forEach(cc => {
    if (cc.from === topic.id) connIds.add(cc.to);
    if (cc.to   === topic.id) connIds.add(cc.from);
  });
  const conns = [...connIds].map(cid => topics.find(x => x.id === cid)).filter(Boolean);

  if (conns.length) {
    const lbl = document.createElement('span');
    lbl.classList.add('connections-label');
    lbl.textContent = 'Verbunden mit:';
    linksDiv.appendChild(lbl);

    conns.forEach(t => {
      const tag = document.createElement('span');
      tag.classList.add('conn-tag');
      tag.textContent = t.label;
      tag.addEventListener('click', () => selectNode(t.id));
      linksDiv.appendChild(tag);
    });
  }

  document.getElementById('detail').classList.remove('hidden');
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function svgEl(tag) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

init();
