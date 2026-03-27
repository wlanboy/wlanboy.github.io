'use strict';

const PALETTE = {
  jvm:           { dark: '#2563eb', light: '#1d4ed8' },
  argocd:        { dark: '#059669', light: '#047857' },
  mcp:           { dark: '#7c3aed', light: '#6d28d9' },
  observability: { dark: '#d97706', light: '#b45309' },
  servicemesh:   { dark: '#e53935', light: '#c62828' }
};

let groups = [], topics = [], crossConnections = [];
let activeGroupIndex = 0;
let carouselCtrl = null; // AbortController for scroll listeners
let navLock = false;     // prevents scroll detection from overriding manual navigation

function accent(groupId) {
  const p = PALETTE[groupId] || { dark: '#555', light: '#333' };
  return document.body.classList.contains('light') ? p.light : p.dark;
}

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  if (localStorage.getItem('theme') === 'light') document.body.classList.add('light');
  syncThemeIcon();

  document.getElementById('toggleTheme').addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
    syncThemeIcon();
    rebuild();
  });

  const data = await fetch('focus.json').then(r => r.json());
  groups           = data.groups;
  topics           = data.topics;
  crossConnections = data.crossConnections || [];

  rebuild();
}

function syncThemeIcon() {
  document.getElementById('toggleTheme').textContent =
    document.body.classList.contains('light') ? '🌙' : '☀️';
}

// ─── Rebuild (called on init + theme change) ─────────────────────────────────

function rebuild() {
  buildCarousel();
  updateDots(activeGroupIndex);
  buildTopics(activeGroupIndex);
}

// ─── Carousel ────────────────────────────────────────────────────────────────

function buildCarousel() {
  const track  = document.getElementById('groups-track');
  const dotsEl = document.getElementById('groups-dots');
  track.innerHTML  = '';
  dotsEl.innerHTML = '';

  // Remove old scroll listeners
  if (carouselCtrl) carouselCtrl.abort();
  carouselCtrl = new AbortController();
  const { signal } = carouselCtrl;

  groups.forEach((g, i) => {
    const count = topics.filter(t => t.group === g.id).length;
    const a     = accent(g.id);

    const card = document.createElement('div');
    card.className     = 'group-card';
    card.dataset.index = i;
    card.style.setProperty('--a', a);
    card.innerHTML = `
      <div class="card-stripe"></div>
      <div class="card-body">
        <div class="card-name">${g.label}</div>
        <div class="card-count">${count} Themen</div>
      </div>
    `;
    // Click: scroll into center AND immediately activate
    card.addEventListener('click', () => {
      card.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
      setActiveGroup(i);
    });
    track.appendChild(card);

    const dot = document.createElement('button');
    dot.className = 'dot';
    dot.setAttribute('aria-label', g.label);
    dot.addEventListener('click', () => {
      document.querySelectorAll('.group-card')[i]
        ?.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
      setActiveGroup(i);
    });
    dotsEl.appendChild(dot);
  });

  // After scroll settles, find which card is closest to center
  const wrapper = document.getElementById('groups-track-wrapper');
  const detectCenter = () => {
    const wRect = wrapper.getBoundingClientRect();
    const wMid  = wRect.left + wRect.width / 2;
    let best = activeGroupIndex, bestDist = Infinity;
    document.querySelectorAll('.group-card').forEach(card => {
      const r    = card.getBoundingClientRect();
      const dist = Math.abs(r.left + r.width / 2 - wMid);
      if (dist < bestDist) { bestDist = dist; best = +card.dataset.index; }
    });
    setActiveGroup(best);
  };

  if ('onscrollend' in wrapper) {
    wrapper.addEventListener('scrollend', detectCenter, { passive: true, signal });
  } else {
    let t;
    wrapper.addEventListener('scroll', () => {
      clearTimeout(t);
      t = setTimeout(detectCenter, 100);
    }, { passive: true, signal });
  }
}

function updateDots(i) {
  document.querySelectorAll('.dot').forEach((d, j) => d.classList.toggle('active', j === i));
}

function setActiveGroup(i) {
  if (navLock) return; // navigateToTopic is in progress — don't let scroll override it
  // Skip if already active and list is populated (avoids resetting open accordions on scroll)
  if (i === activeGroupIndex && document.getElementById('topics-list').children.length > 0) return;
  activeGroupIndex = i;
  updateDots(i);
  buildTopics(i);
}

// ─── Topic list with accordion ───────────────────────────────────────────────

function buildTopics(gi) {
  const g = groups[gi];
  const a = accent(g.id);

  const titleEl = document.getElementById('topics-title');
  titleEl.textContent = g.label;
  titleEl.style.color = a;

  const list = document.getElementById('topics-list');
  list.innerHTML = '';

  topics.filter(t => t.group === g.id).forEach(topic => {
    const connIds = new Set(topic.connections || []);
    crossConnections.forEach(cc => {
      if (cc.from === topic.id) connIds.add(cc.to);
      if (cc.to   === topic.id) connIds.add(cc.from);
    });
    const conns = [...connIds].map(id => topics.find(t => t.id === id)).filter(Boolean);

    // Wrapper
    const item = document.createElement('div');
    item.className  = 'topic-item' + (topic.optional ? ' optional' : '');
    item.dataset.id = topic.id;
    item.style.setProperty('--a', a);

    // Clickable header row
    const header = document.createElement('div');
    header.className = 'topic-header';
    header.innerHTML = `
      <span class="ti-name">${topic.label}</span>
      ${connIds.size ? `<span class="ti-meta">${connIds.size}&thinsp;Verbindungen</span>` : ''}
      <span class="ti-chevron" aria-hidden="true">›</span>
    `;
    header.addEventListener('click', () => toggleTopic(item));

    // Collapsible body (CSS grid trick for height animation)
    const body  = document.createElement('div');
    body.className = 'topic-body';

    const inner = document.createElement('div');
    inner.className = 'topic-body-inner';

    const desc = document.createElement('p');
    desc.className   = 'topic-desc';
    desc.textContent = topic.description;
    inner.appendChild(desc);

    if (conns.length) {
      const lbl = document.createElement('p');
      lbl.className   = 'conn-label';
      lbl.textContent = 'Verbunden mit:';
      inner.appendChild(lbl);

      const tags = document.createElement('div');
      tags.className = 'conn-tags';
      conns.forEach(t => {
        const tag = document.createElement('button');
        tag.className   = 'conn-tag';
        tag.textContent = t.label;
        tag.addEventListener('click', e => {
          e.stopPropagation();
          navigateToTopic(t.id);
        });
        tags.appendChild(tag);
      });
      inner.appendChild(tags);
    }

    body.appendChild(inner);
    item.appendChild(header);
    item.appendChild(body);
    list.appendChild(item);
  });
}

function toggleTopic(item) {
  const wasOpen = item.classList.contains('open');
  // Close all
  document.querySelectorAll('.topic-item.open').forEach(el => el.classList.remove('open'));
  if (!wasOpen) {
    item.classList.add('open');
    requestAnimationFrame(() =>
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    );
  }
}

// Navigate to a connected topic (possibly in a different group)
function navigateToTopic(id) {
  const topic = topics.find(t => t.id === id);
  if (!topic) return;

  const gi = groups.findIndex(g => g.id === topic.group);
  if (gi < 0) return;

  document.querySelectorAll('.topic-item.open').forEach(el => el.classList.remove('open'));

  if (gi !== activeGroupIndex) {
    // Block scroll detection until carousel animation finishes (~600ms)
    navLock = true;
    setTimeout(() => { navLock = false; }, 700);

    document.querySelectorAll('.group-card')[gi]
      ?.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
    activeGroupIndex = gi;
    updateDots(gi);
    buildTopics(gi);
  }

  const item = document.querySelector(`.topic-item[data-id="${id}"]`);
  if (item) {
    item.classList.add('open');
    requestAnimationFrame(() =>
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    );
  }
}

init();
