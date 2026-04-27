export const T = {
  bg0: '#050709', bg1: '#0a0d12', bg2: '#0d1117', bg3: '#11161f', bg4: '#161c26',
  border: '#1f2530', borderHi: '#2a3140',
  text: '#e6e8eb', textHi: '#ffffff', textDim: '#9ba3af',
  textFaint: '#6b7280', textGhost: '#374151',
  warn: '#d97706', danger: '#dc2626', info: '#5b5bd6',
};

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

// Pivot → ordered pane names (Tab cycles through these)
export const PIVOT_PANELS = {
  today:  ['schedule', 'tasks', 'brief', 'triage', 'people'],
  triage: ['triage', 'focus'],
  people: ['people', 'detail'],
};
