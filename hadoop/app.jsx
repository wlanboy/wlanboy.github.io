// Star-chart explorer. Renders constellations as SVG over a deep-night terminal canvas.

const { useState, useEffect, useMemo, useRef, useCallback } = React;

const TWEAKS ={
  "labelMode": "all",
  "isolated": "",
  "showCross": true,
  "layoutMode": "auto"
};

const VIEW_W = 1600;
const VIEW_H = 1000;
const MOBILE_W = 900;
const MOBILE_H = 1600;

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth < 720);
  useEffect(() => {
    const on = () => setM(window.innerWidth < 720);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return m;
}

// --- helpers ---------------------------------------------------------------

function starById(id, data) {
  for (const c of data) {
    const s = c.stars.find(s => s.id === id);
    if (s) return { ...s, constellation: c };
  }
  return null;
}

function starColor(hue, mag) {
  // mag 1 = brightest, mag 3 = dimmest
  const L = mag === 1 ? 0.92 : mag === 2 ? 0.78 : 0.62;
  const C = mag === 1 ? 0.11 : mag === 2 ? 0.09 : 0.06;
  return `oklch(${L} ${C} ${hue})`;
}

function lineColor(hue, alpha = 0.22) {
  return `oklch(0.72 0.08 ${hue} / ${alpha})`;
}

function curvedPath(x1, y1, x2, y2, curvature = 0.18) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  // perpendicular offset
  const cx = mx - dy * curvature;
  const cy = my + dx * curvature;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

// --- background starfield (parallax dust) ---------------------------------

function useStarfield(count = 240, w = 1600, h = 1000) {
  return useMemo(() => {
    const rng = mulberry32(42);
    return Array.from({ length: count }, () => ({
      x: rng() * w,
      y: rng() * h,
      r: rng() * 0.9 + 0.15,
      op: rng() * 0.55 + 0.08,
      depth: rng() * 0.6 + 0.2,
    }));
  }, [count, w, h]);
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// --- main component -------------------------------------------------------

function StarChart() {
  const data = window.CONSTELLATIONS;
  const crossEdges = window.CROSS_EDGES;
  const isMobile = useIsMobile();
  const viewW = isMobile ? MOBILE_W : VIEW_W;
  const viewH = isMobile ? MOBILE_H : VIEW_H;
  const dust = useStarfield(isMobile ? 140 : 240, viewW, viewH);

  const [hover, setHover] = useState(null);       // star id
  const [selected, setSelected] = useState(null); // star id
  const [labelMode, setLabelMode] = useState(TWEAKS.labelMode); // 'all' | 'hover' | 'off'
  const [isolated, setIsolated] = useState(
    TWEAKS.isolated ? TWEAKS.isolated.split(",").filter(Boolean) : []
  );
  const [showCross, setShowCross] = useState(TWEAKS.showCross);
  const [layoutMode, setLayoutMode] = useState(TWEAKS.layoutMode || "manual");
  const [editMode, setEditMode] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  // Compute auto-layout once (memoized) and apply it when layoutMode === 'auto'.
  const autoLayout = useMemo(() => {
    if (!window.AutoLayout) return null;
    return window.AutoLayout.computeAutoLayout(data, viewW, viewH);
  }, [data, viewW, viewH]);

  // On mobile, always auto-layout (manual coords are tuned for landscape).
  const effectiveLayoutMode = isMobile ? "auto" : layoutMode;

  // The data that the rest of the component uses — positions swapped if auto.
  const layoutData = useMemo(() => {
    if (effectiveLayoutMode !== "auto" || !autoLayout) return data;
    return data.map(c => {
      const newStars = c.stars.map(s => {
        const p = autoLayout.positions[s.id];
        return p ? { ...s, x: p.x, y: p.y } : s;
      });
      const nc = autoLayout.centers[c.id];
      return { ...c, stars: newStars, cx: nc?.cx ?? c.cx, cy: nc?.cy ?? c.cy };
    });
  }, [data, effectiveLayoutMode, autoLayout]);

  const svgRef = useRef(null);

  // --- edit mode wiring (Tweaks toolbar) ---
  useEffect(() => {
    function onMsg(e) {
      const d = e.data;
      if (!d || !d.type) return;
      if (d.type === "__activate_edit_mode") setEditMode(true);
      if (d.type === "__deactivate_edit_mode") setEditMode(false);
    }
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const pushEdits = useCallback((edits) => {
    window.parent.postMessage(
      { type: "__edit_mode_set_keys", edits },
      "*"
    );
  }, []);

  // Parallax on pointer move
  const onPointerMove = useCallback((e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setParallax({ x: nx * 22, y: ny * 14 });
  }, []);

  // Compute active constellations (isolation)
  const active = useMemo(() => {
    if (!isolated.length) return new Set(layoutData.map(c => c.id));
    return new Set(isolated);
  }, [isolated, layoutData]);

  // Find the focused star (hover wins over selected for dimming effects)
  const focusId = hover || selected;
  const focusStar = focusId ? starById(focusId, layoutData) : null;

  // Build set of related star ids for dimming
  const relatedIds = useMemo(() => {
    if (!focusId) return null;
    const s = new Set([focusId]);
    for (const c of layoutData) {
      for (const [a, b] of c.lines) {
        if (a === focusId) s.add(b);
        if (b === focusId) s.add(a);
      }
    }
    for (const e of crossEdges) {
      if (e.from === focusId) s.add(e.to);
      if (e.to === focusId) s.add(e.from);
    }
    return s;
  }, [focusId, layoutData, crossEdges])

  // Cross edges to display for focused star
  const focusCrossEdges = useMemo(() => {
    if (!focusId) return [];
    return crossEdges.filter(e => e.from === focusId || e.to === focusId);
  }, [focusId, crossEdges]);

  // ---------- render ----------
  return (
    <div className={`stage ${isMobile ? "mobile" : ""}`}>
      <TopBar isMobile={isMobile} />

      <svg
        ref={svgRef}
        className="chart"
        viewBox={`0 0 ${viewW} ${viewH}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={onPointerMove}
        onClick={(e) => {
          if (e.target === svgRef.current) setSelected(null);
        }}
      >
        {/* deep night gradient */}
        <defs>
          <radialGradient id="sky" cx="50%" cy="45%" r="75%">
            <stop offset="0%"  stopColor="oklch(0.19 0.04 265)" />
            <stop offset="60%" stopColor="oklch(0.13 0.035 260)" />
            <stop offset="100%" stopColor="oklch(0.08 0.02 255)" />
          </radialGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="bigglow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width={viewW} height={viewH} fill="url(#sky)" />

        {/* grid */}
        <g className="grid" opacity="0.08">
          {Array.from({ length: Math.ceil(viewW / 100) + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2={viewH} stroke="oklch(0.7 0.04 250)" strokeWidth="0.5" />
          ))}
          {Array.from({ length: Math.ceil(viewH / 100) + 1 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 100} x2={viewW} y2={i * 100} stroke="oklch(0.7 0.04 250)" strokeWidth="0.5" />
          ))}
        </g>

        {/* crosshair ticks in corners */}
        <Crosshairs w={viewW} h={viewH} />

        {/* parallax dust */}
        <g>
          {dust.map((d, i) => (
            <circle
              key={i}
              cx={d.x + parallax.x * d.depth}
              cy={d.y + parallax.y * d.depth}
              r={d.r}
              fill="oklch(0.95 0.02 250)"
              opacity={d.op * (focusId ? 0.4 : 1)}
            />
          ))}
        </g>

        {/* constellation glow halos */}
        {layoutData.map(c => active.has(c.id) && (
          <circle
            key={`halo-${c.id}`}
            cx={c.cx}
            cy={c.cy}
            r={isMobile ? 220 : 260}
            fill={`oklch(0.3 0.08 ${c.hue} / 0.08)`}
            filter="url(#bigglow)"
          />
        ))}

        {/* intra-constellation lines */}
        {layoutData.map(c => {
          if (!active.has(c.id)) return null;
          return (
            <g key={`lines-${c.id}`}>
              {c.lines.map(([a, b], i) => {
                const sa = c.stars.find(s => s.id === a);
                const sb = c.stars.find(s => s.id === b);
                if (!sa || !sb) return null;
                const isActive = focusId && (a === focusId || b === focusId);
                const dimmed = focusId && !isActive;
                return (
                  <line
                    key={i}
                    x1={sa.x} y1={sa.y}
                    x2={sb.x} y2={sb.y}
                    stroke={lineColor(c.hue, isActive ? 0.75 : 0.28)}
                    strokeWidth={isActive ? 1.6 : 0.8}
                    opacity={dimmed ? 0.15 : 1}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          );
        })}

        {/* cross-domain edges */}
        {showCross && (
          <g>
            {crossEdges.map((e, i) => {
              const sa = starById(e.from, layoutData);
              const sb = starById(e.to, layoutData);
              if (!sa || !sb) return null;
              if (!active.has(sa.constellation.id) || !active.has(sb.constellation.id)) return null;
              const isActive = focusId && (e.from === focusId || e.to === focusId);
              const dimmed = focusId && !isActive;
              const path = curvedPath(sa.x, sa.y, sb.x, sb.y, 0.22);
              return (
                <g key={i} opacity={dimmed ? 0.08 : 1}>
                  <path
                    d={path}
                    fill="none"
                    stroke={isActive ? "oklch(0.96 0.08 80)" : "oklch(0.85 0.05 60 / 0.22)"}
                    strokeWidth={isActive ? 1.4 : 0.7}
                    strokeDasharray={isActive ? "0" : "2 5"}
                    filter={isActive ? "url(#glow)" : undefined}
                  />
                </g>
              );
            })}
          </g>
        )}

        {/* focused cross-edge labels */}
        {showCross && focusCrossEdges.map((e, i) => {
          const sa = starById(e.from, layoutData);
          const sb = starById(e.to, layoutData);
          if (!sa || !sb) return null;
          const mx = (sa.x + sb.x) / 2 - (sb.y - sa.y) * 0.18;
          const my = (sa.y + sb.y) / 2 + (sb.x - sa.x) * 0.18;
          return (
            <g key={`cl-${i}`} transform={`translate(${mx}, ${my})`}>
              <rect
                x={-e.label.length * 4.2}
                y={-10}
                width={e.label.length * 8.4}
                height={20}
                rx="3"
                fill="oklch(0.14 0.03 260 / 0.92)"
                stroke="oklch(0.9 0.1 80 / 0.5)"
                strokeWidth="0.5"
              />
              <text
                textAnchor="middle"
                y={4}
                fontSize="12"
                fontFamily="'JetBrains Mono', monospace"
                fill="oklch(0.95 0.05 80)"
                letterSpacing="0.5"
              >
                {e.label}
              </text>
            </g>
          );
        })}

        {/* constellation names */}
        {layoutData.map(c => active.has(c.id) && (
          <ConstellationLabel
            key={`name-${c.id}`}
            c={c}
            dimmed={focusId && focusStar?.constellation.id !== c.id}
            isMobile={isMobile}
          />
        ))}

        {/* stars */}
        {layoutData.map(c => {
          if (!active.has(c.id)) return null;
          return (
            <g key={`stars-${c.id}`}>
              {c.stars.map(s => {
                const isFocus = focusId === s.id;
                const isRelated = relatedIds?.has(s.id);
                const dimmed = focusId && !isRelated;
                const baseR = s.mag === 1 ? 5 : s.mag === 2 ? 3.5 : 2.3;
                const r = isMobile ? baseR * 1.5 : baseR;
                const hitR = isMobile ? 28 : 14;
                const showLabel =
                  labelMode === "all" ||
                  (labelMode === "hover" && (isFocus || isRelated)) ||
                  isFocus;
                return (
                  <g
                    key={s.id}
                    className="star"
                    opacity={dimmed ? 0.25 : 1}
                    onMouseEnter={() => setHover(s.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelected(s.id);
                    }}
                  >
                    {/* hit target */}
                    <circle
                      cx={s.x} cy={s.y}
                      r={hitR}
                      fill="transparent"
                    />
                    {/* glow */}
                    <circle
                      cx={s.x} cy={s.y}
                      r={r * (isFocus ? 4 : 2.4)}
                      fill={starColor(c.hue, s.mag)}
                      opacity={isFocus ? 0.35 : 0.14}
                      filter="url(#glow)"
                    />
                    {/* core */}
                    <circle
                      cx={s.x} cy={s.y}
                      r={isFocus ? r + 1.2 : r}
                      fill={starColor(c.hue, s.mag)}
                    />
                    {/* tick cross on focus */}
                    {isFocus && (
                      <g stroke={starColor(c.hue, 1)} strokeWidth="0.8" opacity="0.7">
                        <line x1={s.x - 14} y1={s.y} x2={s.x - 7} y2={s.y} />
                        <line x1={s.x + 7}  y1={s.y} x2={s.x + 14} y2={s.y} />
                        <line x1={s.x} y1={s.y - 14} x2={s.x} y2={s.y - 7} />
                        <line x1={s.x} y1={s.y + 7}  x2={s.x} y2={s.y + 14} />
                      </g>
                    )}
                    {/* label */}
                    {showLabel && (
                      <text
                        x={s.x + r + 6}
                        y={s.y + 4}
                        fontSize={isFocus ? (isMobile ? 22 : 14) : (isMobile ? 18 : 11)}
                        fontFamily="'JetBrains Mono', monospace"
                        fill={isFocus ? "oklch(0.98 0.02 80)" : `oklch(0.82 0.05 ${c.hue})`}
                        letterSpacing="0.4"
                      >
                        {s.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          star={starById(selected, layoutData)}
          crossEdges={crossEdges.filter(e => e.from === selected || e.to === selected)}
          intraEdges={getIntraEdges(selected, layoutData)}
          onClose={() => setSelected(null)}
          onJump={(id) => setSelected(id)}
          data={layoutData}
        />
      )}

      {/* Tweaks panel */}
      {editMode && (
        <TweaksPanel
          labelMode={labelMode}
          setLabelMode={(v) => { setLabelMode(v); pushEdits({ labelMode: v }); }}
          isolated={isolated}
          setIsolated={(v) => { setIsolated(v); pushEdits({ isolated: v.join(",") }); }}
          showCross={showCross}
          setShowCross={(v) => { setShowCross(v); pushEdits({ showCross: v }); }}
          layoutMode={layoutMode}
          setLayoutMode={(v) => { setLayoutMode(v); pushEdits({ layoutMode: v }); }}
          data={layoutData}
          isMobile={isMobile}
        />
      )}

      <StatusBar
        total={layoutData.reduce((a, c) => a + c.stars.length, 0)}
        crossCount={crossEdges.length}
        focus={focusStar}
        isolated={isolated}
      />
    </div>
  );
}

function getIntraEdges(id, data) {
  for (const c of data) {
    const related = [];
    for (const [a, b] of c.lines) {
      if (a === id) related.push({ other: b, constellation: c });
      if (b === id) related.push({ other: a, constellation: c });
    }
    if (related.length) return related;
  }
  return [];
}

// --- bits ------------------------------------------------------------------

function Crosshairs({ w, h }) {
  const ticks = [];
  const len = 14;
  const positions = [
    [30, 30],
    [w - 30, 30],
    [30, h - 30],
    [w - 30, h - 30],
  ];
  return (
    <g stroke="oklch(0.7 0.04 250 / 0.35)" strokeWidth="1">
      {positions.map(([x, y], i) => (
        <g key={i}>
          <line x1={x - len} y1={y} x2={x + len} y2={y} />
          <line x1={x} y1={y - len} x2={x} y2={y + len} />
        </g>
      ))}
    </g>
  );
}

function ConstellationLabel({ c, dimmed, isMobile }) {
  // Position label at top-left of constellation's bounding box
  const xs = c.stars.map(s => s.x);
  const ys = c.stars.map(s => s.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const catSize = isMobile ? 16 : 11;
  const nameSize = isMobile ? 30 : 20;
  const offY = isMobile ? 60 : 40;
  return (
    <g opacity={dimmed ? 0.25 : 1} transform={`translate(${minX - 30}, ${minY - offY})`}>
      <text
        fontFamily="'JetBrains Mono', monospace"
        fontSize={catSize}
        fill={`oklch(0.8 0.1 ${c.hue})`}
        letterSpacing="2"
      >
        {c.catalog}
      </text>
      <text
        y={isMobile ? 32 : 22}
        fontFamily="'JetBrains Mono', monospace"
        fontSize={nameSize}
        fontWeight="600"
        fill={`oklch(0.92 0.12 ${c.hue})`}
        letterSpacing="3"
      >
        {c.name}
      </text>
      <line
        x1="0" y1={isMobile ? 44 : 30}
        x2={isMobile ? 180 : 120} y2={isMobile ? 44 : 30}
        stroke={`oklch(0.8 0.1 ${c.hue} / 0.5)`}
        strokeWidth="1"
      />
    </g>
  );
}

function TopBar({ isMobile, onToggleTweaks }) {
  return (
    <div className="topbar">
      <div className="tb-left">
        <span className="dot" />
        <span className="mono">stellarium://topics.chart</span>
      </div>
      {!isMobile && <div className="tb-title mono">— TOPIC CONSTELLATION MAP · ed. 01 —</div>}
      <div className="tb-right mono">
        {!isMobile && <span>lat 47.40°N</span>}
        {!isMobile && <span>lon 8.55°E</span>}
        <span className="blink">●</span>
      </div>
    </div>
  );
}

function StatusBar({ total, crossCount, focus, isolated }) {
  return (
    <div className="statusbar mono">
      <span>★ {total} stars</span>
      <span>◇ {crossCount} cross-links</span>
      <span>{isolated.length ? `iso: ${isolated.join("+")}` : "iso: —"}</span>
      <span className="spacer" />
      {focus ? (
        <span>
          <em style={{ color: `oklch(0.9 0.1 ${focus.constellation.hue})` }}>
            {focus.constellation.catalog}
          </em>
          &nbsp;/&nbsp;{focus.label}
        </span>
      ) : (
        <span className="hint">hover sterne · klick für details</span>
      )}
    </div>
  );
}

function DetailPanel({ star, crossEdges, intraEdges, onClose, onJump, data }) {
  if (!star) return null;
  const hue = star.constellation.hue;

  const intraNames = intraEdges.map(e => {
    const s = star.constellation.stars.find(x => x.id === e.other);
    return { id: e.other, label: s?.label || e.other };
  });

  const crossNames = crossEdges.map(e => {
    const otherId = e.from === star.id ? e.to : e.from;
    const other = starById(otherId, data);
    return { id: otherId, label: other?.label || otherId, relation: e.label, hue: other?.constellation.hue };
  });

  return (
    <div className="detail" style={{ "--accent": `oklch(0.85 0.12 ${hue})` }}>
      <button className="close" onClick={onClose} aria-label="close">✕</button>
      <div className="detail-catalog mono">
        {star.constellation.catalog} · {star.constellation.name}
      </div>
      <div className="detail-name">{star.label}</div>
      <div className="detail-meta mono">
        <span>mag {star.mag}</span>
        <span>·</span>
        <span>ra {Math.round(star.x)}</span>
        <span>·</span>
        <span>dec {Math.round(star.y)}</span>
        <span>·</span>
        <span>id {star.id}</span>
      </div>

      {star.desc && (
        <div className="section">
          <div className="section-h mono">— beschreibung</div>
          <div className="detail-desc">{star.desc}</div>
        </div>
      )}

      <div className="section">
        <div className="section-h mono">— same constellation</div>
        {intraNames.length ? (
          <ul className="pill-list">
            {intraNames.map(n => (
              <li key={n.id} onClick={() => onJump(n.id)}>
                <span className="pill-tick">→</span> {n.label}
              </li>
            ))}
          </ul>
        ) : <div className="empty mono">keine</div>}
      </div>

      <div className="section">
        <div className="section-h mono">— cross-domain links</div>
        {crossNames.length ? (
          <ul className="cross-list">
            {crossNames.map(n => (
              <li key={n.id + n.relation} onClick={() => onJump(n.id)}>
                <div className="cross-rel mono">{n.relation}</div>
                <div className="cross-tgt">
                  <span className="dot-color" style={{ background: `oklch(0.85 0.12 ${n.hue})` }} />
                  {n.label}
                </div>
              </li>
            ))}
          </ul>
        ) : <div className="empty mono">keine</div>}
      </div>
    </div>
  );
}

function TweaksPanel({ labelMode, setLabelMode, isolated, setIsolated, showCross, setShowCross, layoutMode, setLayoutMode, data }) {
  function toggleIsolate(id) {
    if (isolated.includes(id)) setIsolated(isolated.filter(x => x !== id));
    else setIsolated([...isolated, id]);
  }

  return (
    <div className="tweaks">
      <div className="tweaks-h mono">TWEAKS</div>

      <div className="tweak-group">
        <div className="tweak-label mono">layout</div>
        <div className="seg">
          {["manual", "auto"].map(v => (
            <button
              key={v}
              className={layoutMode === v ? "on" : ""}
              onClick={() => setLayoutMode(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="tweak-group">
        <div className="tweak-label mono">labels</div>
        <div className="seg">
          {["all", "hover", "off"].map(v => (
            <button
              key={v}
              className={labelMode === v ? "on" : ""}
              onClick={() => setLabelMode(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="tweak-group">
        <div className="tweak-label mono">isolate constellations</div>
        <div className="iso-list">
          {data.map(c => {
            const on = isolated.includes(c.id);
            return (
              <button
                key={c.id}
                className={`iso ${on ? "on" : ""}`}
                onClick={() => toggleIsolate(c.id)}
                style={{ "--hue": c.hue }}
              >
                <span className="iso-dot" />
                {c.name.toLowerCase()}
              </button>
            );
          })}
          {isolated.length > 0 && (
            <button className="iso reset" onClick={() => setIsolated([])}>
              reset
            </button>
          )}
        </div>
      </div>

      <div className="tweak-group">
        <label className="checkrow">
          <input
            type="checkbox"
            checked={showCross}
            onChange={(e) => setShowCross(e.target.checked)}
          />
          <span className="mono">cross-domain arcs</span>
        </label>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<StarChart />);
