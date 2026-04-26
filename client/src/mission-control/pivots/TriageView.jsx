import React, { useState, useMemo } from 'react';
import { T } from '../theme.js';
import { Panel } from '../components/Panel.jsx';
import { TriageStream } from '../panels/TriageStream.jsx';

function ActionBtn({ children, primary, accent, hot }) {
  return (
    <button style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px',
      background: primary ? accent : T.bg3,
      color: primary ? T.bg0 : T.text,
      border: primary ? 'none' : `1px solid ${T.border}`,
      borderRadius: 4, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
      fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
    }}>
      {children}
      {hot && <kbd style={{ fontSize: 9.5, padding: '1px 4px', borderRadius: 3, background: T.bg0, color: T.textDim, border: `1px solid ${T.border}` }}>{hot}</kbd>}
    </button>
  );
}

const SlackIcon = () => <svg viewBox="0 0 16 16" width="11" height="11"><rect x="2" y="6" width="3" height="3" rx=".7" fill="#E01E5A"/><rect x="6" y="2" width="3" height="3" rx=".7" fill="#36C5F0"/><rect x="11" y="6" width="3" height="3" rx=".7" fill="#2EB67D"/><rect x="6" y="11" width="3" height="3" rx=".7" fill="#ECB22E"/></svg>;
const MailIcon = () => <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="4" width="12" height="9" rx="1.5"/><path d="m2.5 5 5.5 4 5.5-4"/></svg>;
const CalIcon = () => <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M5 2v3M11 2v3"/></svg>;
const ICONS = { slack: SlackIcon, email: MailIcon, cal: CalIcon };

function FocusDetail({ item, accent }) {
  if (!item) return <div style={{ padding: '32px 18px', color: T.textGhost, fontSize: 12, fontFamily: 'ui-monospace, Menlo, monospace' }}>select an item with j/k</div>;
  const Icon = ICONS[item.kind] ?? MailIcon;
  return (
    <div style={{ padding: '14px 18px', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: T.textDim }}>
        <Icon />
        {item.kind}{item.channel ? ` · ${item.channel}` : ''}
        {item.urgent && <span style={{ color: T.warn, marginLeft: 6 }}>· URGENT · {item.age}</span>}
      </div>
      <div style={{ fontSize: 18, color: T.textHi, fontWeight: 600, marginTop: 8 }}>{item.from}</div>
      {item.subject && <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 2 }}>{item.subject}</div>}
      <div style={{ marginTop: 14, padding: '12px 14px', background: T.bg3, borderLeft: `2px solid ${accent}`, fontSize: 12.5, color: T.text, lineHeight: 1.6 }}>
        {item.preview}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
        <ActionBtn primary accent={accent} hot="r">reply</ActionBtn>
        <ActionBtn accent={accent} hot="e">to task</ActionBtn>
        <ActionBtn accent={accent} hot="s">snooze 2h</ActionBtn>
        <ActionBtn accent={accent} hot="a">archive</ActionBtn>
        <ActionBtn accent={accent} hot="c">claude draft</ActionBtn>
      </div>
    </div>
  );
}

export function TriageView({ panelFocus, cursors, accent, filter, setFilter, onTriageLoaded }) {
  const [items, setItems] = useState([]);

  const handleLoaded = (list) => { setItems(list); onTriageLoaded?.(list); };

  const visibleItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'urgent') return items.filter(t => t.urgent);
    return items.filter(t => t.lane === filter);
  }, [items, filter]);

  const focusedItem = visibleItems[cursors.triage] ?? null;

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '420px 1fr 260px', gap: 1, background: T.border, overflow: 'hidden', minHeight: 0 }}>
      <Panel title="triage_stream" hint="j/k" focused={panelFocus === 'triage'} accent={accent}
        right={<span>{items.length} items{items.filter(i => i.urgent).length > 0 ? ` · ${items.filter(i => i.urgent).length} urgent` : ''}</span>}>
        <TriageStream focused={panelFocus === 'triage'} cursor={cursors.triage} accent={accent} filter={filter} setFilter={setFilter} onLoaded={handleLoaded} />
      </Panel>
      <Panel title="focus" hint="enter open" focused={panelFocus === 'focus'} accent={accent}>
        <FocusDetail item={focusedItem} accent={accent} />
      </Panel>
      <Panel title="ambient" focused={false} accent={accent}>
        <div style={{ padding: 11, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: T.textDim }}>
          <div style={{ color: accent, fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em' }}>URGENT</div>
          <div style={{ marginTop: 6 }}>
            {items.filter(i => i.urgent).slice(0, 5).map(i => (
              <div key={i.id} style={{ display: 'flex', gap: 6, padding: '2px 0', fontSize: 10.5 }}>
                <span style={{ color: T.textGhost, minWidth: 36 }}>{i.age}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.from}</span>
              </div>
            ))}
            {items.filter(i => i.urgent).length === 0 && <span style={{ color: T.textGhost }}>none</span>}
          </div>
        </div>
      </Panel>
    </div>
  );
}
