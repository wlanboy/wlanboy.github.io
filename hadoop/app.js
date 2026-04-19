(function () {
  const VIEW_W = 1600, VIEW_H = 1000;
  const MOBILE_W = 900, MOBILE_H = 1600;

  function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5; let r = t;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function starColor(hue, mag) {
    const L = mag === 1 ? 0.92 : mag === 2 ? 0.78 : 0.62;
    const C = mag === 1 ? 0.11 : mag === 2 ? 0.09 : 0.06;
    return `oklch(${L} ${C} ${hue})`;
  }
  function lineColor(hue, a = 0.22) { return `oklch(0.72 0.08 ${hue} / ${a})`; }
  function curvedPath(x1, y1, x2, y2, c = 0.18) {
    const mx = (x1+x2)/2, my = (y1+y2)/2, dx = x2-x1, dy = y2-y1;
    return `M ${x1} ${y1} Q ${mx - dy*c} ${my + dx*c} ${x2} ${y2}`;
  }
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function starById(id, data) {
    for (const c of data) { const s = c.stars.find(s => s.id === id); if (s) return {...s, constellation: c}; }
    return null;
  }

  function makeStarfield(count, w, h) {
    const rng = mulberry32(42);
    return Array.from({length: count}, () => ({
      x: rng()*w, y: rng()*h, r: rng()*0.9+0.15, op: rng()*0.55+0.08, depth: rng()*0.6+0.2,
    }));
  }

  // ── state ──────────────────────────────────────────────────────────────────

  const S = {
    hover: null, selected: null,
    labelMode: 'all', isolated: [],
    showCross: true, layoutMode: 'auto',
    editMode: false, parallax: {x:0, y:0},
    isMobile: window.innerWidth < 720,
  };

  let _dust = null, _autoLayout = null, _layoutData = null;

  function dims() { return S.isMobile ? [MOBILE_W, MOBILE_H] : [VIEW_W, VIEW_H]; }

  function getLayoutData() {
    if (_layoutData) return _layoutData;
    const data = window.CONSTELLATIONS;
    const [vW, vH] = dims();
    const mode = S.isMobile ? 'auto' : S.layoutMode;
    if (mode !== 'auto') return data;
    if (!_autoLayout) _autoLayout = window.AutoLayout?.computeAutoLayout(data, vW, vH) ?? null;
    if (!_autoLayout) return data;
    _layoutData = data.map(c => {
      const stars = c.stars.map(s => { const p = _autoLayout.positions[s.id]; return p ? {...s, ...p} : s; });
      const nc = _autoLayout.centers[c.id];
      return {...c, stars, cx: nc?.cx ?? c.cx, cy: nc?.cy ?? c.cy};
    });
    return _layoutData;
  }

  function getDust() {
    const [vW, vH] = dims(), count = S.isMobile ? 140 : 240;
    if (!_dust || _dust.length !== count) _dust = makeStarfield(count, vW, vH);
    return _dust;
  }

  function invalidateLayout() { _autoLayout = null; _layoutData = null; }
  function invalidateAll()    { _dust = null; _autoLayout = null; _layoutData = null; }

  // ── DOM ────────────────────────────────────────────────────────────────────

  const svgEl    = document.getElementById('chart');
  const detailEl = document.getElementById('detail-container');
  const tweaksEl = document.getElementById('tweaks-container');
  const statusEl = document.getElementById('statusbar');
  const topbarEl = document.getElementById('topbar');
  const stageEl  = document.getElementById('stage');

  // ── render ─────────────────────────────────────────────────────────────────

  function render() {
    const ld = getLayoutData();
    const ce = window.CROSS_EDGES;
    const [vW, vH] = dims();
    const {hover, selected, labelMode, isolated, showCross, parallax, isMobile, editMode} = S;

    const focusId  = hover || selected;
    const focusStar = focusId ? starById(focusId, ld) : null;
    const active   = isolated.length ? new Set(isolated) : new Set(ld.map(c => c.id));

    let rel = null;
    if (focusId) {
      rel = new Set([focusId]);
      for (const c of ld) for (const [a,b] of c.lines) { if (a===focusId) rel.add(b); if (b===focusId) rel.add(a); }
      for (const e of ce) { if (e.from===focusId) rel.add(e.to); if (e.to===focusId) rel.add(e.from); }
    }

    // grid
    const gridV = Array.from({length: Math.ceil(vW/100)+1}, (_,i) =>
      `<line x1="${i*100}" y1="0" x2="${i*100}" y2="${vH}" stroke="oklch(0.7 0.04 250)" stroke-width="0.5"/>`).join('');
    const gridH = Array.from({length: Math.ceil(vH/100)+1}, (_,i) =>
      `<line x1="0" y1="${i*100}" x2="${vW}" y2="${i*100}" stroke="oklch(0.7 0.04 250)" stroke-width="0.5"/>`).join('');

    // crosshairs
    const ch = [[30,30],[vW-30,30],[30,vH-30],[vW-30,vH-30]].map(([x,y]) =>
      `<line x1="${x-14}" y1="${y}" x2="${x+14}" y2="${y}"/><line x1="${x}" y1="${y-14}" x2="${x}" y2="${y+14}"/>`
    ).join('');

    // dust
    const dust = getDust();
    const dustSvg = dust.map(d =>
      `<circle cx="${d.x + parallax.x*d.depth}" cy="${d.y + parallax.y*d.depth}" r="${d.r}" fill="oklch(0.95 0.02 250)" opacity="${d.op*(focusId?0.4:1)}"/>`
    ).join('');

    // halos
    const halos = ld.map(c => active.has(c.id)
      ? `<circle cx="${c.cx}" cy="${c.cy}" r="${isMobile?220:260}" fill="oklch(0.3 0.08 ${c.hue} / 0.08)" filter="url(#bigglow)"/>`
      : '').join('');

    // intra lines
    const intraLines = ld.map(c => {
      if (!active.has(c.id)) return '';
      return c.lines.map(([a,b]) => {
        const sa = c.stars.find(s=>s.id===a), sb = c.stars.find(s=>s.id===b);
        if (!sa||!sb) return '';
        const act = focusId && (a===focusId||b===focusId), dim = focusId && !act;
        return `<line x1="${sa.x}" y1="${sa.y}" x2="${sb.x}" y2="${sb.y}" stroke="${lineColor(c.hue, act?0.75:0.28)}" stroke-width="${act?1.6:0.8}" opacity="${dim?0.15:1}" stroke-linecap="round"/>`;
      }).join('');
    }).join('');

    // cross edges
    let crossSvg = '';
    if (showCross) {
      const focusCE = focusId ? ce.filter(e=>e.from===focusId||e.to===focusId) : [];
      crossSvg = ce.map(e => {
        const sa = starById(e.from, ld), sb = starById(e.to, ld);
        if (!sa||!sb||!active.has(sa.constellation.id)||!active.has(sb.constellation.id)) return '';
        const act = focusId && (e.from===focusId||e.to===focusId), dim = focusId && !act;
        return `<g opacity="${dim?0.08:1}"><path d="${curvedPath(sa.x,sa.y,sb.x,sb.y,0.22)}" fill="none" stroke="${act?'oklch(0.96 0.08 80)':'oklch(0.85 0.05 60 / 0.22)'}" stroke-width="${act?1.4:0.7}" stroke-dasharray="${act?'0':'2 5'}"${act?' filter="url(#glow)"':''}/></g>`;
      }).join('') + focusCE.map(e => {
        if (!e.label) return '';
        const sa = starById(e.from, ld), sb = starById(e.to, ld);
        if (!sa||!sb) return '';
        const mx = (sa.x+sb.x)/2-(sb.y-sa.y)*0.18, my = (sa.y+sb.y)/2+(sb.x-sa.x)*0.18;
        return `<g transform="translate(${mx},${my})"><rect x="${-e.label.length*4.2}" y="-10" width="${e.label.length*8.4}" height="20" rx="3" fill="oklch(0.14 0.03 260 / 0.92)" stroke="oklch(0.9 0.1 80 / 0.5)" stroke-width="0.5"/><text text-anchor="middle" y="4" font-size="12" font-family="ui-monospace,monospace" fill="oklch(0.95 0.05 80)" letter-spacing="0.5">${esc(e.label)}</text></g>`;
      }).join('');
    }

    // constellation labels
    const constLabels = ld.map(c => {
      if (!active.has(c.id)) return '';
      const xs = c.stars.map(s=>s.x), ys = c.stars.map(s=>s.y);
      const minX = Math.min(...xs), minY = Math.min(...ys);
      const dim = focusId && focusStar?.constellation.id !== c.id;
      const catS = isMobile?16:11, nameS = isMobile?30:20, offY = isMobile?60:40;
      return `<g opacity="${dim?0.25:1}" transform="translate(${minX-30},${minY-offY})"><text font-family="ui-monospace,monospace" font-size="${catS}" fill="oklch(0.8 0.1 ${c.hue})" letter-spacing="2">${esc(c.catalog)}</text><text y="${isMobile?32:22}" font-family="ui-monospace,monospace" font-size="${nameS}" font-weight="600" fill="oklch(0.92 0.12 ${c.hue})" letter-spacing="3">${esc(c.name)}</text><line x1="0" y1="${isMobile?44:30}" x2="${isMobile?180:120}" y2="${isMobile?44:30}" stroke="oklch(0.8 0.1 ${c.hue} / 0.5)" stroke-width="1"/></g>`;
    }).join('');

    // stars
    const starsSvg = ld.map(c => {
      if (!active.has(c.id)) return '';
      return c.stars.map(s => {
        const isFoc = focusId===s.id, isRel = rel?.has(s.id), dim = focusId && !isRel;
        const baseR = s.mag===1?5:s.mag===2?3.5:2.3, r = isMobile?baseR*1.5:baseR, hitR = isMobile?28:14;
        const showLbl = labelMode==='all'||(labelMode==='hover'&&(isFoc||isRel))||isFoc;
        const col = starColor(c.hue, s.mag);
        const tick = isFoc ? `<g stroke="${col}" stroke-width="0.8" opacity="0.7"><line x1="${s.x-14}" y1="${s.y}" x2="${s.x-7}" y2="${s.y}"/><line x1="${s.x+7}" y1="${s.y}" x2="${s.x+14}" y2="${s.y}"/><line x1="${s.x}" y1="${s.y-14}" x2="${s.x}" y2="${s.y-7}"/><line x1="${s.x}" y1="${s.y+7}" x2="${s.x}" y2="${s.y+14}"/></g>` : '';
        const lbl = showLbl ? `<text x="${s.x+r+6}" y="${s.y+4}" font-size="${isFoc?(isMobile?26:18):(isMobile?22:14)}" font-family="ui-monospace,monospace" fill="${isFoc?'oklch(0.98 0.02 80)':`oklch(0.82 0.05 ${c.hue})`}" letter-spacing="0.4">${esc(s.label)}</text>` : '';
        return `<g class="star" data-star-id="${s.id}" opacity="${dim?0.25:1}"><circle cx="${s.x}" cy="${s.y}" r="${hitR}" fill="transparent"/><circle cx="${s.x}" cy="${s.y}" r="${r*(isFoc?4:2.4)}" fill="${col}" opacity="${isFoc?0.35:0.14}" filter="url(#glow)"/><circle cx="${s.x}" cy="${s.y}" r="${isFoc?r+1.2:r}" fill="${col}"/>${tick}${lbl}</g>`;
      }).join('');
    }).join('');

    svgEl.setAttribute('viewBox', `0 0 ${vW} ${vH}`);
    svgEl.innerHTML =
      `<defs><radialGradient id="sky" cx="50%" cy="45%" r="75%"><stop offset="0%" stop-color="oklch(0.19 0.04 265)"/><stop offset="60%" stop-color="oklch(0.13 0.035 260)"/><stop offset="100%" stop-color="oklch(0.08 0.02 255)"/></radialGradient><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="bigglow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
      `<rect x="0" y="0" width="${vW}" height="${vH}" fill="url(#sky)"/>` +
      `<g class="grid" opacity="0.08">${gridV}${gridH}</g>` +
      `<g stroke="oklch(0.7 0.04 250 / 0.35)" stroke-width="1">${ch}</g>` +
      `<g id="dust-layer">${dustSvg}</g>` +
      `<g>${halos}</g><g>${intraLines}</g><g>${crossSvg}</g><g>${constLabels}</g><g>${starsSvg}</g>`;

    // detail panel
    if (!selected) {
      detailEl.innerHTML = '';
    } else {
      const star = starById(selected, ld);
      if (!star) { detailEl.innerHTML = ''; }
      else {
        const hue = star.constellation.hue;
        const intraIds = [];
        for (const [a,b] of star.constellation.lines) {
          if (a===selected) intraIds.push(b); else if (b===selected) intraIds.push(a);
        }
        const intraNames = intraIds.map(id => {
          const s = star.constellation.stars.find(x => x.id===id);
          return {id, label: s?.label||id};
        });
        const crossNames = ce
          .filter(e => e.from===selected||e.to===selected)
          .map(e => {
            const oid = e.from===selected ? e.to : e.from;
            const other = starById(oid, ld);
            return {id: oid, label: other?.label||oid, relation: e.label, hue: other?.constellation.hue};
          });

        detailEl.innerHTML =
          `<div class="detail" style="--accent:oklch(0.85 0.12 ${hue})">` +
          `<button class="close" id="detail-close" aria-label="close">✕</button>` +
          `<div class="detail-catalog mono">${esc(star.constellation.catalog)} · ${esc(star.constellation.name)}</div>` +
          `<div class="detail-name">${esc(star.label)}</div>` +
          `<div class="detail-meta mono"><span>mag ${star.mag}</span><span>·</span><span>ra ${Math.round(star.x)}</span><span>·</span><span>dec ${Math.round(star.y)}</span><span>·</span><span>id ${esc(star.id)}</span></div>` +
          (star.desc ? `<div class="section"><div class="section-h mono">— beschreibung</div><div class="detail-desc" id="_desc"></div></div>` : '') +
          `<div class="section"><div class="section-h mono">— same constellation</div>` +
          (intraNames.length
            ? `<ul class="pill-list">${intraNames.map(n=>`<li data-jump="${n.id}"><span class="pill-tick">→</span> ${esc(n.label)}</li>`).join('')}</ul>`
            : `<div class="empty mono">keine</div>`) +
          `</div><div class="section"><div class="section-h mono">— cross-domain links</div>` +
          (crossNames.length
            ? `<ul class="cross-list">${crossNames.map(n=>`<li data-jump="${n.id}"><div class="cross-rel mono">${esc(n.relation)}</div><div class="cross-tgt"><span class="dot-color" style="background:oklch(0.85 0.12 ${n.hue})"></span>${esc(n.label)}</div></li>`).join('')}</ul>`
            : `<div class="empty mono">keine</div>`) +
          `</div></div>`;

        if (star.desc) document.getElementById('_desc').textContent = star.desc;
      }
    }

    // tweaks panel
    if (!editMode) {
      tweaksEl.innerHTML = '';
    } else {
      const isoButtons = ld.map(c =>
        `<button class="iso${S.isolated.includes(c.id)?' on':''}" data-iso="${c.id}" style="--hue:${c.hue}"><span class="iso-dot"></span>${esc(c.name.toLowerCase())}</button>`
      ).join('');
      tweaksEl.innerHTML =
        `<div class="tweaks"><div class="tweaks-h mono">TWEAKS</div>` +
        `<div class="tweak-group"><div class="tweak-label mono">layout</div><div class="seg">` +
        ['manual','auto'].map(v=>`<button data-layout="${v}" class="${S.layoutMode===v?'on':''}">${v}</button>`).join('') +
        `</div></div><div class="tweak-group"><div class="tweak-label mono">labels</div><div class="seg">` +
        ['all','hover','off'].map(v=>`<button data-label="${v}" class="${S.labelMode===v?'on':''}">${v}</button>`).join('') +
        `</div></div><div class="tweak-group"><div class="tweak-label mono">isolate constellations</div><div class="iso-list">` +
        isoButtons + (S.isolated.length?`<button class="iso reset" data-iso-reset="">reset</button>`:'') +
        `</div></div><div class="tweak-group"><label class="checkrow"><input type="checkbox" id="cross-toggle"${S.showCross?' checked':''}> <span class="mono">cross-domain arcs</span></label></div></div>`;
    }

    // status bar
    const total = ld.reduce((a,c)=>a+c.stars.length, 0);
    statusEl.innerHTML =
      `<span>★ ${total} stars</span><span>◇ ${ce.length} cross-links</span>` +
      `<span>${S.isolated.length?`iso: ${S.isolated.join('+')}`:'iso: —'}</span>` +
      `<span class="spacer"></span>` +
      (focusStar
        ? `<span><em style="color:oklch(0.9 0.1 ${focusStar.constellation.hue})">${esc(focusStar.constellation.catalog)}</em>&nbsp;/&nbsp;${esc(focusStar.label)}</span>`
        : `<span class="hint">hover sterne · klick für details</span>`);

    // topbar
    topbarEl.innerHTML =
      `<div class="tb-left"><span class="dot"></span><span class="mono">stellarium://topics.chart</span></div>` +
      (!isMobile?`<div class="tb-title mono">— TOPIC CONSTELLATION MAP · ed. 01 —</div>`:'') +
      `<div class="tb-right mono">${!isMobile?`<span>lat 47.40°N</span><span>lon 8.55°E</span>`:''}<span class="blink">●</span></div>`;

    stageEl.className = `stage${isMobile?' mobile':''}`;
  }

  // ── parallax fast path ─────────────────────────────────────────────────────

  let _raf = false;
  function updateDust() {
    const layer = document.getElementById('dust-layer');
    if (!layer) return;
    const dust = getDust(), focusId = S.hover||S.selected, cc = layer.children;
    for (let i = 0; i < dust.length; i++) {
      const d = dust[i], c = cc[i]; if (!c) continue;
      c.setAttribute('cx', d.x + S.parallax.x*d.depth);
      c.setAttribute('cy', d.y + S.parallax.y*d.depth);
      c.setAttribute('opacity', d.op*(focusId?0.4:1));
    }
  }

  // ── events ─────────────────────────────────────────────────────────────────

  svgEl.addEventListener('pointermove', e => {
    const r = svgEl.getBoundingClientRect();
    S.parallax = {x: ((e.clientX-r.left)/r.width-0.5)*22, y: ((e.clientY-r.top)/r.height-0.5)*14};
    if (!_raf) { _raf = true; requestAnimationFrame(() => { _raf = false; updateDust(); }); }
  });

  svgEl.addEventListener('mouseover', e => {
    const g = e.target.closest('[data-star-id]');
    const id = g ? g.getAttribute('data-star-id') : null;
    if (id !== S.hover) { S.hover = id; render(); }
  });

  svgEl.addEventListener('mouseleave', () => {
    if (S.hover !== null) { S.hover = null; render(); }
  });

  svgEl.addEventListener('click', e => {
    const g = e.target.closest('[data-star-id]');
    if (g) { S.selected = g.getAttribute('data-star-id'); render(); }
    else { S.selected = null; render(); }
  });

  detailEl.addEventListener('click', e => {
    if (e.target.closest('#detail-close')) { S.selected = null; render(); return; }
    const j = e.target.closest('[data-jump]');
    if (j) { S.selected = j.getAttribute('data-jump'); render(); }
  });

  tweaksEl.addEventListener('click', e => {
    const lb = e.target.closest('[data-layout]');
    if (lb) { invalidateLayout(); S.layoutMode = lb.getAttribute('data-layout'); render(); pushEdits({layoutMode: S.layoutMode}); return; }
    const lbl = e.target.closest('[data-label]');
    if (lbl) { S.labelMode = lbl.getAttribute('data-label'); render(); pushEdits({labelMode: S.labelMode}); return; }
    const iso = e.target.closest('[data-iso]');
    if (iso) { const id = iso.getAttribute('data-iso'); S.isolated = S.isolated.includes(id)?S.isolated.filter(x=>x!==id):[...S.isolated,id]; render(); pushEdits({isolated: S.isolated.join(',')}); return; }
    if (e.target.closest('[data-iso-reset]')) { S.isolated = []; render(); pushEdits({isolated:''}); }
  });

  tweaksEl.addEventListener('change', e => {
    if (e.target.id === 'cross-toggle') { S.showCross = e.target.checked; render(); pushEdits({showCross: S.showCross}); }
  });

  window.addEventListener('message', e => {
    const d = e.data; if (!d?.type) return;
    if (d.type==='__activate_edit_mode')   { S.editMode = true;  render(); }
    if (d.type==='__deactivate_edit_mode') { S.editMode = false; render(); }
  });
  window.parent.postMessage({type: '__edit_mode_available'}, '*');

  window.addEventListener('resize', () => {
    const m = window.innerWidth < 720;
    if (m !== S.isMobile) { S.isMobile = m; invalidateAll(); render(); }
  });

  function pushEdits(edits) {
    window.parent.postMessage({type: '__edit_mode_set_keys', edits}, '*');
  }

  render();
})();
