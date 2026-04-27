import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../ThemeContext.jsx';

const COMMANDS = [
  { k: '/task',   d: 'Add a task to Notion',         shortcut: 't' },
  { k: '/note',   d: "Append to today's daily note",  shortcut: 'n' },
  { k: '/ask',    d: 'Ask Claude (streaming)',         shortcut: 'a' },
  { k: '/brief',  d: 'Regenerate morning brief',      shortcut: 'b' },
  { k: '/find',   d: 'Search Notion + recent',        shortcut: 'f' },
  { k: '/1on1',   d: 'Open person detail',            shortcut: '1' },
  { k: '/triage', d: 'Open triage pivot',             shortcut: 'i' },
  { k: '/today',  d: 'Jump to today pivot',           shortcut: 'h' },
  { k: '/people', d: 'Jump to people pivot',          shortcut: 'p' },
];

const CmdIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 4a1.5 1.5 0 1 1-1.5 1.5V11A1.5 1.5 0 1 1 5 9.5h6A1.5 1.5 0 1 1 12.5 11V5.5A1.5 1.5 0 1 1 11 4H5z"/>
  </svg>
);

export function CommandPalette({ open, onClose, onCommand }) {
  const T = useTheme();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setQ(''); setIdx(0); setStatus(''); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  const filtered = useMemo(() => {
    if (!q) return COMMANDS;
    const lower = q.toLowerCase();
    return COMMANDS.filter((c) => c.k.includes(lower) || c.d.toLowerCase().includes(lower));
  }, [q]);

  // Keyboard handling inside palette input is done via onKeyDown since useKeyboard skips inputs
  const onKeyDown = async (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[idx];
      if (!cmd) return;
      const arg = q.startsWith(cmd.k) ? q.slice(cmd.k.length).trim() : '';
      const result = await onCommand?.(cmd.k, arg);
      if (result?.close) onClose();
      if (result?.status) setStatus(result.status);
    }
  };

  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(5,7,9,.65)',
      backdropFilter: 'blur(4px)', zIndex: 100,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 580, borderRadius: 10, overflow: 'hidden',
        background: T.bg2, border: `1px solid ${T.borderHi}`,
        boxShadow: `0 24px 60px rgba(0,0,0,.5), 0 0 0 1px ${T.accent}33`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
          <span style={{ color: T.accent }}><CmdIcon /></span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); setStatus(''); }}
            onKeyDown={onKeyDown}
            placeholder="type a command, or ask Claude…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, color: T.textHi,
              fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
            }}
          />
          <kbd style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: T.bg0, color: T.textDim, border: `1px solid ${T.border}`, fontFamily: 'ui-monospace, Menlo, monospace' }}>esc</kbd>
        </div>

        <div className="mc-scroll" style={{ padding: 6, maxHeight: 320, overflow: 'auto' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.textFaint, padding: '8px 12px 4px', fontFamily: 'ui-monospace, Menlo, monospace' }}>
            commands · {filtered.length}
          </div>
          {filtered.map((c, i) => (
            <div key={c.k} onClick={() => setIdx(i)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 5,
              background: i === idx ? T.bg4 : 'transparent',
              borderLeft: i === idx ? `2px solid ${T.accent}` : '2px solid transparent',
              cursor: 'pointer',
            }}>
              <code style={{ fontSize: 12, color: i === idx ? T.accent : T.textDim, fontWeight: 600, minWidth: 70, fontFamily: 'ui-monospace, Menlo, monospace' }}>{c.k}</code>
              <span style={{ fontSize: 12.5, flex: 1, color: i === idx ? T.textHi : T.text }}>{c.d}</span>
              <kbd style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: T.bg0, border: `1px solid ${T.border}`, color: T.textDim, fontFamily: 'ui-monospace, Menlo, monospace' }}>{c.shortcut}</kbd>
            </div>
          ))}
        </div>

        <div style={{ padding: '7px 14px', fontSize: 10, borderTop: `1px solid ${T.border}`, background: T.bg0, color: status ? T.accent : T.textGhost, fontFamily: 'ui-monospace, Menlo, monospace', display: 'flex', gap: 14 }}>
          {status
            ? <span>{status}</span>
            : <><span>up/down pick</span><span>enter run</span><span>esc close</span></>}
        </div>
      </div>
    </div>
  );
}
