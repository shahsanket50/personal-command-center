import React from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  Settings,
  Terminal,
  FileText,
  Calendar,
  Sun,
  MessageSquare,
  Mail,
  Users,
  Target,
} from 'lucide-react';
import { getThemeForModule, themes } from './themes/index.js';
import { clsx } from 'clsx';

// Module imports
import SettingsModule from './modules/settings/index.jsx';
import ClaudeCLI from './modules/claude-cli/index.jsx';
import NotesTasks from './modules/notes-tasks/index.jsx';
import CalendarModule from './modules/calendar/index.jsx';
import MorningBrief from './modules/morning-brief/index.jsx';
import Slack from './modules/slack/index.jsx';
import Email from './modules/email/index.jsx';
import People from './modules/people/index.jsx';
import LifeGoals from './modules/life-goals/index.jsx';

const navItems = [
  { path: '/settings', label: 'Settings', icon: Settings, module: 'settings' },
  { path: '/claude-cli', label: 'Claude CLI', icon: Terminal, module: 'claude-cli' },
  { path: '/notes-tasks', label: 'Notes & Tasks', icon: FileText, module: 'notes-tasks' },
  { path: '/calendar', label: 'Calendar', icon: Calendar, module: 'calendar' },
  { path: '/morning-brief', label: 'Morning Brief', icon: Sun, module: 'morning-brief' },
  { path: '/slack', label: 'Slack', icon: MessageSquare, module: 'slack' },
  { path: '/email', label: 'Email', icon: Mail, module: 'email' },
  { path: '/people', label: 'People & 1:1s', icon: Users, module: 'people' },
  { path: '/life-goals', label: 'Life & Goals', icon: Target, module: 'life-goals' },
];

function useActiveModule() {
  const location = useLocation();
  const segment = location.pathname.split('/')[1] || 'settings';
  return segment;
}

export default function App() {
  const activeModule = useActiveModule();

  // Theme is purely derived from the active module — no global override state.
  // Claude CLI is always dark; all other modules auto-switch per getThemeForModule.
  const theme =
    activeModule === 'claude-cli'
      ? themes.dark
      : getThemeForModule(activeModule);

  return (
    <div className={clsx('flex h-screen w-screen overflow-hidden', theme.app)}>
      {/* Sidebar */}
      <aside className={clsx('flex flex-col w-56 shrink-0 border-r', theme.sidebar)}>
        {/* Logo / Title */}
        <div className={clsx('px-5 py-5 border-b', theme.divider)}>
          <h1 className={clsx('text-sm font-semibold tracking-wide uppercase', theme.subheading)}>
            Command Center
          </h1>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive ? theme.sidebarItemActive : theme.sidebarItem
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className={clsx('px-5 py-3 border-t text-xs', theme.divider, theme.subheading)}>
          Personal OS · v0.1
        </div>
      </aside>

      {/* Main Content */}
      <main className={clsx('flex-1 overflow-y-auto', theme.content)}>
        <Routes>
          <Route path="/" element={<SettingsModule theme={theme} />} />
          <Route path="/settings" element={<SettingsModule theme={theme} />} />
          <Route path="/claude-cli" element={<ClaudeCLI theme={theme} />} />
          <Route path="/notes-tasks" element={<NotesTasks theme={theme} />} />
          <Route path="/calendar" element={<CalendarModule theme={theme} />} />
          <Route path="/morning-brief" element={<MorningBrief theme={theme} />} />
          <Route path="/slack" element={<Slack theme={theme} />} />
          <Route path="/email" element={<Email theme={theme} />} />
          <Route path="/people" element={<People theme={theme} />} />
          <Route path="/life-goals" element={<LifeGoals theme={theme} />} />
        </Routes>
      </main>
    </div>
  );
}
