import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const FIELDS = {
  accounts: [
    { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', secret: true, placeholder: 'sk-ant-...' },
    { key: 'NOTION_API_KEY', label: 'Notion API Key', secret: true, placeholder: 'secret_...' },
    { key: 'SLACK_BOT_TOKEN', label: 'Slack Bot Token', secret: true, placeholder: 'xoxb-...' },
    { key: '_section_ms', label: 'Microsoft 365 (Office)', type: 'section' },
    { key: 'MS_ACCOUNT_OFFICE', label: 'Office Email', secret: false, placeholder: 'you@company.com' },
    { key: 'MS_TENANT_ID', label: 'Azure AD Tenant ID', secret: false, placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    { key: 'MS_CLIENT_ID', label: 'Azure App Client ID', secret: true, placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    { key: 'MS_CLIENT_SECRET', label: 'Azure App Client Secret', secret: true, placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
    { key: '_section_google', label: 'Google (Personal)', type: 'section' },
    { key: 'GMAIL_ACCOUNT_PERSONAL', label: 'Personal Gmail', secret: false, placeholder: 'you@gmail.com' },
    { key: 'GOOGLE_CLIENT_ID', label: 'Google Client ID', secret: true, placeholder: 'xxxxxx.apps.googleusercontent.com' },
    { key: 'GOOGLE_CLIENT_SECRET', label: 'Google Client Secret', secret: true, placeholder: 'GOCSPX-...' },
  ],
  notion: [
    { key: 'NOTION_ROOT_PAGE_ID', label: 'Root Page ID', placeholder: '32-char page ID' },
    { key: 'NOTION_DB_DAILY_BRIEFINGS', label: 'Daily Briefings DB', placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_TASKS', label: 'Tasks DB', placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_PEOPLE', label: 'People DB', placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_ACTION_ITEMS', label: 'Action Items DB', placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_HABITS_GOALS', label: 'Habits & Goals DB', placeholder: '32-char DB ID' },
    { key: 'NOTION_DB_TRAVEL_BOOKINGS', label: 'Travel & Bookings DB', placeholder: '32-char DB ID' },
  ],
};

function Field({ field, value, onChange, secretSet, theme }) {
  const [show, setShow] = useState(false);
  const isSecret = field.secret;
  const inputType = isSecret && !show ? 'password' : 'text';

  return (
    <div className="space-y-1.5">
      <label className={clsx('block text-sm font-medium', theme.label)}>
        {field.label}
        {isSecret && secretSet && (
          <span className="ml-2 text-xs text-green-600 font-normal">● set</span>
        )}
      </label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={isSecret && secretSet && !value ? '••••••••••••' : field.placeholder}
          className={clsx(
            'w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
            theme.input
          )}
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className={clsx('absolute right-3 top-2 text-xs', theme.subheading)}
          >
            {show ? 'hide' : 'show'}
          </button>
        )}
      </div>
    </div>
  );
}

function SelectField({ field, value, onChange, theme }) {
  return (
    <div className="space-y-1.5">
      <label className={clsx('block text-sm font-medium', theme.label)}>{field.label}</label>
      <select
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        className={clsx(
          'w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
          theme.input
        )}
      >
        {field.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </option>
        ))}
      </select>
      <p className={clsx('text-xs mt-1', theme.subheading)}>
        {value === 'auto' && 'Auto — dark for CLI, clean for Calendar/Notes/Settings/People, cards for Slack/Email/Briefs.'}
        {value === 'dark' && 'Dark — terminal-style across all modules.'}
        {value === 'clean' && 'Clean — white/gray across all modules.'}
        {value === 'cards' && 'Cards — card-based layout across all modules.'}
      </p>
    </div>
  );
}

const TABS = ['Accounts', 'Notion'];

export default function SettingsModule({ theme }) {
  const [activeTab, setActiveTab] = useState('Accounts');
  const [values, setValues] = useState({});
  const [secretsSet, setSecretsSet] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'ok' | 'error'
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, message }
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const { _secrets, ...rest } = data;
        setValues(rest);
        setSecretsSet(_secrets || {});
        setServerError(null);
      })
      .catch((err) => {
        setServerError(
          err.message.includes('Failed to fetch')
            ? 'Cannot reach server — is it running? (cd server && npm run dev)'
            : err.message
        );
      });
  }, []);

  function handleChange(key, val) {
    setValues((prev) => ({ ...prev, [key]: val }));
    setSaveStatus(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      setSaveStatus(data.ok ? 'ok' : 'error');
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  }

  async function handleTestNotion() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/notion/test');
      const data = await res.json();
      const msg = data.ok
        ? data.warning
          ? `Token OK (${data.bot}) — ${data.warning}`
          : `Connected — bot "${data.bot}", page ${data.page?.id}`
        : data.error;
      setTestResult({ ok: data.ok, message: msg });
    } catch (e) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setTesting(false);
    }
  }

  const tabKey = activeTab.toLowerCase();
  const currentFields = FIELDS[tabKey] ?? FIELDS.appearance;

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <h1 className={clsx('text-2xl font-semibold mb-1', theme.heading)}>Settings</h1>

      {serverError && (
        <div className="mb-6 flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3">
          <XCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{serverError}</p>
        </div>
      )}

      <p className={clsx('text-sm mb-8', theme.subheading)}>
        Configure your integrations and preferences. Values are saved to your local <code>.env</code> file.
      </p>

      {/* Tabs */}
      <div className={clsx('flex gap-0 border-b mb-8', theme.divider)}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab
                ? clsx('border-blue-600 text-blue-600')
                : clsx('border-transparent', theme.subheading, 'hover:text-gray-900')
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Fields */}
      <div className="space-y-6">
        {currentFields.map((field) =>
          field.type === 'section' ? (
            <div key={field.key} className={clsx('pt-4 pb-1 border-t', theme.divider)}>
              <p className={clsx('text-xs font-semibold uppercase tracking-wider', theme.subheading)}>{field.label}</p>
            </div>
          ) : field.type === 'select' ? (
            <SelectField
              key={field.key}
              field={field}
              value={values[field.key] ?? 'auto'}
              onChange={handleChange}
              theme={theme}
            />
          ) : (
            <Field
              key={field.key}
              field={field}
              value={values[field.key] ?? ''}
              onChange={handleChange}
              secretSet={secretsSet[field.key]}
              theme={theme}
            />
          )
        )}

        {/* Notion test connection button */}
        {activeTab === 'Notion' && (
          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={handleTestNotion}
              disabled={testing}
              className={clsx(
                'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                theme.buttonSecondary,
                testing && 'opacity-60 cursor-not-allowed'
              )}
            >
              {testing && <Loader2 size={14} className="animate-spin" />}
              Test Notion Connection
            </button>
            {testResult && (
              <span
                className={clsx(
                  'flex items-center gap-1.5 text-sm',
                  testResult.ok ? 'text-green-600' : 'text-red-500'
                )}
              >
                {testResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {testResult.message}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Save bar */}
      <div className={clsx('flex items-center gap-4 mt-10 pt-6 border-t', theme.divider)}>
        <button
          onClick={handleSave}
          disabled={saving}
          className={clsx(
            'inline-flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-colors',
            theme.button,
            saving && 'opacity-70 cursor-not-allowed'
          )}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saveStatus === 'ok' && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle size={14} /> Saved
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="flex items-center gap-1.5 text-sm text-red-500">
            <XCircle size={14} /> Save failed
          </span>
        )}
      </div>
    </div>
  );
}
