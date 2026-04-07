/**
 * Theme configurations for the Personal Command Center.
 * Each theme exports a set of Tailwind class strings for consistent styling.
 */

export const themes = {
  dark: {
    name: 'dark',
    app: 'bg-gray-950 text-gray-100',
    sidebar: 'bg-gray-900 border-gray-800',
    sidebarItem: 'text-gray-400 hover:text-gray-100 hover:bg-gray-800',
    sidebarItemActive: 'text-green-400 bg-gray-800',
    content: 'bg-gray-950',
    card: 'bg-gray-900 border-gray-800',
    input: 'bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500',
    label: 'text-gray-300',
    heading: 'text-gray-100',
    subheading: 'text-gray-400',
    button: 'bg-green-600 hover:bg-green-500 text-white',
    buttonSecondary: 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700',
    divider: 'border-gray-800',
    tab: 'text-gray-400 border-gray-700',
    tabActive: 'text-green-400 border-green-400',
  },
  clean: {
    name: 'clean',
    app: 'bg-gray-50 text-gray-900',
    sidebar: 'bg-white border-gray-200',
    sidebarItem: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
    sidebarItemActive: 'text-blue-600 bg-blue-50',
    content: 'bg-gray-50',
    card: 'bg-white border-gray-200',
    input: 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
    label: 'text-gray-700',
    heading: 'text-gray-900',
    subheading: 'text-gray-500',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
    buttonSecondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300',
    divider: 'border-gray-200',
    tab: 'text-gray-500 border-gray-200',
    tabActive: 'text-blue-600 border-blue-600',
  },
  cards: {
    name: 'cards',
    app: 'bg-slate-100 text-gray-900',
    sidebar: 'bg-slate-800 border-slate-700',
    sidebarItem: 'text-slate-300 hover:text-white hover:bg-slate-700',
    sidebarItemActive: 'text-white bg-slate-600',
    content: 'bg-slate-100',
    card: 'bg-white border-slate-200 shadow-sm',
    input: 'bg-white border-slate-300 text-gray-900 placeholder-gray-400',
    label: 'text-slate-700',
    heading: 'text-slate-900',
    subheading: 'text-slate-500',
    button: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    buttonSecondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300',
    divider: 'border-slate-200',
    tab: 'text-slate-500 border-slate-200',
    tabActive: 'text-indigo-600 border-indigo-600',
  },
};

/**
 * Returns the theme for a given module path segment.
 * @param {string} module - e.g. 'settings', 'claude-cli', 'slack'
 * @returns {object} theme config
 */
export function getThemeForModule(module) {
  if (module === 'claude-cli') return themes.dark;
  if (['slack', 'email', 'life-goals', 'morning-brief'].includes(module)) return themes.cards;
  return themes.clean; // settings, calendar, notes-tasks, people, default
}

export default themes;
