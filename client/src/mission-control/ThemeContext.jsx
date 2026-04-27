import React, { createContext, useContext, useState, useCallback } from 'react';
import { THEMES, DEFAULT_THEME } from './theme.js';

const ThemeContext = createContext(THEMES[DEFAULT_THEME]);

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(() => {
    const saved = localStorage.getItem('mc-theme');
    return THEMES[saved] ? saved : DEFAULT_THEME;
  });

  const setTheme = useCallback((name) => {
    if (!THEMES[name]) return;
    localStorage.setItem('mc-theme', name);
    setThemeName(name);
  }, []);

  return (
    <ThemeContext.Provider value={{ ...THEMES[themeName], themeName, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
