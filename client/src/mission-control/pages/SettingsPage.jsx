import React, { useState, useEffect, useRef } from 'react';
import { THEME_NAMES, THEMES } from '../theme.js';
import { useTheme } from '../ThemeContext.jsx';
import { Panel } from '../components/Panel.jsx';

const API = 'http://localhost:3001/api';

const FIELDS = {
  Accounts: [
    { key: 'ANTHROPIC_API_KEY',    label: 'Anthropic API Key',       secret: true,  placeholder: 'sk-ant-...' },
    { key: 'NOTION_API_KEY',       label: 'Notion API Key',          secret: true,  placeholder: 'secret_...' },
    { key: 'SLACK_BOT_TOKEN',      label: 'Slack Bot Token',         secret: true,  placeholder: 'xoxb-...' },
    { key: '_section_ms',          label: 'Microsoft 365 (Office)',  type: 'section' },
    { key: 'MS_ACCOUNT_OFFICE',    label: 'Office Email',            secret: false, placeholder: 'you@company.com' },
    { key: 'MS_TENANT_ID',         label: 'Azure AD Tenant ID',      secret: false, placeholder: 'xxxxxxxx-...' },
    { key: 'MS_CLIENT_ID',         label: 'Azure App Client ID',     secret: true,  placeholder: 'xxxxxxxx-...' },
    { key: 'MS_CLIENT_SECRET',     label: 'Azure App Client Secret', secret: true,  placeholder: '...' },
    { key: '_section_google',      label: 'Google (Personal)',       type: 'section' },
    { key: 'GMAIL_ACCOUNT_PERSONAL', label: 'Personal Gmail',        secret: false, placeholder: 'you@gmail.com' },
    { key: 'GOOGLE_CLIENT_ID',     label: 'Google Client ID',        secret: true,  placeholder: '....apps.googleusercontent.com' },
    { key: 'GOOGLE_CLIENT_SECRET', label: 'Google Client Secret',    secret: true,  placeholder: 'GOCSPX-...' },
  ],
  Notion: [
    { key: 'NOTION_ROOT_PAGE_ID',        label: 'Root Page ID',         placeholder: '32-char page ID' },
    { key: 'NOTION_DB_DAILY_BRIEFINGS',  label: 'Daily Briefings DB',   placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_TASKS',            label: 'Tasks DB',             placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_PEOPLE',           label: 'People DB',            placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_ACTION_ITEMS',     label: 'Action Items DB',      placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_HABITS_GOALS',     label: 'Habits & Goals DB',    placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_TRAVEL_BOOKINGS',  label: 'Travel & Bookings DB', placeholder: '32-char DB ID' },
  ],
};

function SecretField({ field, value, onChange }) {
  const T = useTheme();
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14.5, color: T.textDim, marginBottom: 4 }}>
        {field.label}
        {value && <span style={{ marginLeft: 8, color: T.accent, fontSize: 11 }}>● set</span>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type={field.secret && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(field.key, e.target.value)}
          placeholder={field.secret && !value ? '........' : field.placeholder}
          style={{
            flex: 1, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 3,
            color: T.text, fontSize: 13.5, padding: '5px 8px', outline: 'none',
            fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
          }}
        />
        {field.secret && (
          <button onClick={() => setShow(s => !s)} style={{ background: 'transparent', border: 'none', color: T.textGhost, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>
            {show ? 'hide' : 'show'}
          </button>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const T = useTheme();
  const { themeName, setTheme } = T;
  const [activeTab, setActiveTab] = useState('Accounts');
  const [values, setValues] = useState({});
  const [saveStatus, setSaveStatus] = useState('');
  const [notionTest, setNotionTest] = useState(null);
  const notionTestTimerRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/settings`).then(r => r.json()).then(data => {
      setValues(data.values ?? {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => clearTimeout(notionTestTimerRef.current);
  }, []);

  function handleChange(key, val) { setValues(prev => ({ ...prev, [key]: val })); }

  async function handleSave() {
    setSaveStatus('saving...');
    try {
      const res = await fetch(`${API}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values }) });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      setSaveStatus('saved'); setTimeout(() => setSaveStatus(''), 2000);
    } catch { setSaveStatus('error'); }
  }

  async function handleTestNotion() {
    setNotionTest('testing...');
    try {
      const res = await fetch(`${API}/notion/test`);
      const data = await res.json();
      setNotionTest(data.ok ? 'connected' : 'failed: ' + (data.error ?? 'unknown'));
    } catch { setNotionTest('request failed'); }
    notionTestTimerRef.current = setTimeout(() => setNotionTest(null), 4000);
  }

  const fields = FIELDS[activeTab] ?? [];

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }}>
      <Panel title="settings" accent={T.accent}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          {['Accounts', 'Notion', 'Appearance'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
              color: activeTab === tab ? T.accent : T.textDim, fontSize: 15,
              borderBottom: activeTab === tab ? `2px solid ${T.accent}` : '2px solid transparent',
              fontFamily: 'inherit',
            }}>{tab}</button>
          ))}
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
          {fields.map(f => {
            if (f.type === 'section') return (
              <div key={f.key} style={{ fontSize: 11, letterSpacing: '.1em', color: T.textGhost, marginTop: 20, marginBottom: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                {f.label.toUpperCase()}
              </div>
            );
            return <SecretField key={f.key} field={f} value={values[f.key] ?? ''} onChange={handleChange} />;
          })}
          {activeTab === 'Notion' && (
            <div style={{ marginTop: 8 }}>
              <button onClick={handleTestNotion} style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 3, color: T.textDim, cursor: 'pointer', fontSize: 14.5, padding: '5px 12px', fontFamily: 'inherit' }}>
                Test Notion Connection
              </button>
              {notionTest && <span style={{ marginLeft: 10, fontSize: 14.5, color: notionTest.startsWith('connected') ? T.accent : T.danger }}>{notionTest}</span>}
            </div>
          )}
          {activeTab === 'Appearance' && (
            <div>
              <div style={{ fontSize: 14.5, color: T.textDim, marginBottom: 12 }}>
                theme
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {THEME_NAMES.map(name => {
                  const th = THEMES[name];
                  const active = name === themeName;
                  return (
                    <button
                      key={name}
                      onClick={() => setTheme(name)}
                      title={name}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                      }}
                    >
                      <div style={{
                        width: 48, height: 48, borderRadius: 8,
                        background: th.bg0,
                        border: active ? `2px solid ${T.textHi}` : `2px solid ${T.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: active ? `0 0 0 1px ${th.accent}` : 'none',
                      }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: th.accent }} />
                      </div>
                      <span style={{
                        fontSize: 11.5, color: active ? T.textHi : T.textFaint,
                        fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
                      }}>
                        {name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {activeTab !== 'Appearance' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '10px 20px', borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
            {saveStatus && <span style={{ fontSize: 14.5, color: saveStatus === 'error' ? T.danger : T.textDim }}>{saveStatus}</span>}
            <button onClick={handleSave} style={{ background: T.bg3, border: `1px solid ${T.borderHi}`, borderRadius: 3, color: T.accent, cursor: 'pointer', fontSize: 15, padding: '5px 16px', fontFamily: 'inherit' }}>
              Save
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
