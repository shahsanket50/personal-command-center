// Five named theme token sets. Each replaces the old static T export.
export const THEMES = {
  dark: {
    bg0: '#050709', bg1: '#0a0d12', bg2: '#0d1117', bg3: '#11161f', bg4: '#161c26',
    border: '#1f2530', borderHi: '#2a3140',
    text: '#e6e8eb', textHi: '#ffffff', textDim: '#9ba3af',
    textFaint: '#6b7280', textGhost: '#374151',
    warn: '#d97706', danger: '#dc2626', info: '#5b5bd6',
    accent: '#86efac',
  },
  light: {
    bg0: '#f8fafc', bg1: '#f1f5f9', bg2: '#e8edf3', bg3: '#dde3eb', bg4: '#d0d7e1',
    border: '#cbd5e1', borderHi: '#94a3b8',
    text: '#1e293b', textHi: '#0f172a', textDim: '#475569',
    textFaint: '#64748b', textGhost: '#94a3b8',
    warn: '#d97706', danger: '#dc2626', info: '#5b5bd6',
    accent: '#16a34a',
  },
  paper: {
    bg0: '#faf7f2', bg1: '#f5f0e8', bg2: '#ede6d8', bg3: '#e5dccb', bg4: '#dbd1be',
    border: '#c8b89a', borderHi: '#a89070',
    text: '#3c2e20', textHi: '#2c1e10', textDim: '#7c5c3e',
    textFaint: '#a08060', textGhost: '#c0a080',
    warn: '#d97706', danger: '#dc2626', info: '#5b5bd6',
    accent: '#c2610a',
  },
  ocean: {
    bg0: '#020d1a', bg1: '#041220', bg2: '#061828', bg3: '#0c2233', bg4: '#102840',
    border: '#1a3a55', borderHi: '#2a5070',
    text: '#94c8e8', textHi: '#e0f2fe', textDim: '#5a90b0',
    textFaint: '#3a6080', textGhost: '#2a4a60',
    warn: '#d97706', danger: '#ef4444', info: '#38bdf8',
    accent: '#38bdf8',
  },
  forest: {
    bg0: '#080f0a', bg1: '#0c1510', bg2: '#101a12', bg3: '#152015', bg4: '#1a2818',
    border: '#253525', borderHi: '#304530',
    text: '#86c890', textHi: '#dcfce7', textDim: '#4a7a50',
    textFaint: '#2a5030', textGhost: '#1e3822',
    warn: '#d97706', danger: '#ef4444', info: '#4ade80',
    accent: '#4ade80',
  },
};

export const DEFAULT_THEME = 'dark';
export const THEME_NAMES = Object.keys(THEMES);

export const LANE_META = {
  dm:        { label: 'DMs',          color: '#36C5F0', desc: 'direct messages' },
  mention:   { label: '@mentions',    color: '#E01E5A', desc: 'tagged in a thread or channel' },
  reply:     { label: 'replies',      color: '#5b5bd6', desc: 'emails awaiting your reply' },
  invite:    { label: 'invites',      color: '#86efac', desc: 'calendar invites awaiting RSVP' },
  broadcast: { label: 'FYI · slack',  color: '#6b7280', desc: 'channel chatter — read-only' },
  fyi:       { label: 'FYI · email',  color: '#6b7280', desc: 'newsletters & notifications' },
};

export const LANE_ORDER = ['mention', 'dm', 'reply', 'invite', 'broadcast', 'fyi'];

export const PIVOTS = [
  { id: 'today',  label: 'Today',  key: 'g t' },
  { id: 'triage', label: 'Triage', key: 'g i' },
  { id: 'people', label: 'People', key: 'g p' },
];

export const PIVOT_PANELS = {
  today:  ['schedule', 'tasks', 'brief', 'triage', 'people'],
  triage: ['triage', 'focus'],
  people: ['people', 'detail'],
};
