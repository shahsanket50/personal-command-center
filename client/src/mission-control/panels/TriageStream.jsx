import React, { useState, useEffect, useMemo } from 'react';
import { T, LANE_META, LANE_ORDER } from '../theme.js';

const API = 'http://localhost:3001/api';
const COLLAPSED_DEFAULTS = new Set(['broadcast', 'fyi']);

const SlackIcon = () => <svg viewBox="0 0 16 16" width="11" height="11"><rect x="2" y="6" width="3" height="3" rx=".7" fill="#E01E5A"/><rect x="6" y="2" width="3" height="3" rx=".7" fill="#36C5F0"/><rect x="11" y="6" width="3" height="3" rx=".7" fill="#2EB67D"/><rect x="6" y="11" width="3" height="3" rx=".7" fill="#ECB22E"/></svg>;
const MailIcon = () => <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="4" width="12" height="9" rx="1.5"/><path d="m2.5 5 5.5 4 5.5-4"/></svg>;
const CalIcon = () => <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M5 2v3M11 2v3"/></svg>;
const AlertIcon = () => <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2 1.5 13.5h13L8 2zM8 6.5v3M8 11.5v.5"/></svg>;

const KIND_ICON = { slack: SlackIcon, email: MailIcon, cal: CalIcon };

function FilterChips({ active, setActive, counts, accent }) {
  const chips = [
    { id: 'all', label: 'all', n: counts.all },
    { id: 'urgent', label: 'urgent', n: counts.urgent },
    ...LANE_ORDER.map((l) => ({ id: l, label: LANE_META[l].label, n: counts[l] ?? 0, dot: LANE_META[l].color })),
  ];
  return (
    <div style={{ display: 'flex', gap: 5, padding: '6px 11px', flexWrap: 'wrap', borderBottom: `1px solid ${T.border}`, background: T.bg1, fontFamily: 'ui-monospace, Menlo, monospace', flexShrink: 0 }}>
      {chips.map((c) => {
        const on = active === c.id;
        return (
          <button key={c.id} onClick={() => setActive(c.id)} onMouseDown={(e) => e.preventDefault()} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px',
            background: on ? T.bg4 : 'transparent',
            color: on ? accent : T.textDim,
            border: `1px solid ${on ? accent + '66' : T.border}`,
            borderRadius: 10, cursor: 'pointer', fontSize: 10.5, fontWeight: 500, fontFamily: 'inherit', outline: 'none',
          }}>
            {c.dot && <span style={{ width: 5, height: 5, borderRadius: 3, background: c.dot, display: 'inline-block' }} />}
            {c.label}
            <span style={{ color: on ? accent : T.textGhost, fontSize: 9.5 }}>{c.n}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TriageStream({ focused, cursor, accent, filter, setFilter, compact, onLoaded }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(COLLAPSED_DEFAULTS);

  useEffect(() => {
    fetch(`${API}/triage/items`)
      .then(r => r.json())
      .then((data) => { const list = Array.isArray(data) ? data : []; setItems(list); onLoaded?.(list); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c = { all: items.length, urgent: items.filter(t => t.urgent).length };
    LANE_ORDER.forEach((l) => { c[l] = items.filter(t => t.lane === l).length; });
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'urgent') return items.filter(t => t.urgent);
    return items.filter(t => t.lane === filter);
  }, [items, filter]);

  const sections = useMemo(() => {
    if (filter !== 'all') return [{ lane: null, items: filtered }];
    return LANE_ORDER.map((lane) => ({ lane, items: filtered.filter(t => t.lane === lane) })).filter(s => s.items.length > 0);
  }, [filtered, filter]);

  const visibleFlat = sections.flatMap((s) => collapsed.has(s.lane ?? '') ? [] : s.items);

  if (loading) return <div style={{ padding: '18px 12px', color: T.textGhost, fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace' }}>loading triage…</div>;

  const toggleCollapse = (lane) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(lane)) next.delete(lane); else next.add(lane);
    return next;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      {!compact && <FilterChips active={filter} setActive={setFilter} counts={counts} accent={accent} />}
      <div className="mc-scroll" style={{ flex: 1, overflow: 'auto', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11 }}>
        {sections.map((sec, si) => {
          const isCollapsed = collapsed.has(sec.lane ?? '');
          return (
            <div key={sec.lane ?? 'flat'}>
              {sec.lane && (
                <div onClick={() => toggleCollapse(sec.lane)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px 4px',
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
                  color: T.textFaint, borderTop: si === 0 ? 'none' : `1px solid ${T.bg2}`, cursor: 'pointer',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: 3, background: LANE_META[sec.lane]?.color ?? T.textGhost }} />
                  {LANE_META[sec.lane]?.label}
                  <span style={{ color: T.textGhost, fontWeight: 500 }}>{sec.items.length}</span>
                  <span style={{ color: T.textGhost, fontWeight: 400, marginLeft: 4, textTransform: 'none', letterSpacing: 0 }}>· {LANE_META[sec.lane]?.desc}</span>
                  <span style={{ marginLeft: 'auto' }}>{isCollapsed ? '▸' : '▾'}</span>
                </div>
              )}
              {isCollapsed
                ? <div onClick={() => toggleCollapse(sec.lane)} style={{ padding: '4px 11px', fontSize: 10, color: T.textGhost, cursor: 'pointer', borderBottom: `1px solid ${T.bg2}` }}>show {sec.items.length} {LANE_META[sec.lane]?.label}</div>
                : sec.items.map((it) => {
                    const flatIdx = visibleFlat.indexOf(it);
                    const isCursor = focused && cursor === flatIdx;
                    const laneColor = LANE_META[it.lane]?.color ?? T.textGhost;
                    const Icon = KIND_ICON[it.kind] ?? MailIcon;
                    return (
                      <div key={it.id} style={{
                        padding: '6px 11px',
                        background: isCursor ? T.bg4 : 'transparent',
                        borderBottom: `1px solid ${T.bg2}`,
                        borderLeft: isCursor ? `2px solid ${accent}` : `2px solid ${laneColor}22`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon />
                          <span style={{ color: it.urgent ? T.warn : T.text, fontWeight: it.urgent ? 600 : 400 }}>{it.from}</span>
                          {it.channel && <span style={{ color: T.textFaint }}>{it.channel}</span>}
                          {it.urgent && <AlertIcon />}
                          <span style={{ color: T.textGhost, marginLeft: 'auto', fontSize: 10 }}>{it.age}</span>
                        </div>
                        <div style={{ color: isCursor ? T.text : T.textDim, marginTop: 2, fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 17 }}>
                          {it.subject ? <span style={{ color: T.text, fontWeight: 600 }}>{it.subject}{' '}</span> : null}
                          {it.preview}
                        </div>
                      </div>
                    );
                  })}
            </div>
          );
        })}
        {visibleFlat.length === 0 && !loading && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: T.textGhost, fontSize: 11.5 }}>
            {filter === 'all' ? 'inbox zero.' : `no ${filter} items.`}
          </div>
        )}
      </div>
    </div>
  );
}
