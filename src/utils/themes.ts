export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
  accentColor: string;
  hoverColor: string;
  activeColor: string;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'custom';
  fontSize: number;
  customTheme?: ThemeColors;
  showGitBlame: boolean;
}

export const darkTheme: ThemeColors = {
  bgPrimary: '#1e1e1e',
  bgSecondary: '#252526',
  textPrimary: '#d4d4d4',
  textSecondary: '#858585',
  borderColor: '#3e3e42',
  accentColor: '#007acc',
  hoverColor: '#2a2d2e',
  activeColor: '#094771',
};

export const lightTheme: ThemeColors = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f8f8f8',
  textPrimary: '#1e1e1e',
  textSecondary: '#6c6c6c',
  borderColor: '#e5e5e5',
  accentColor: '#0078d4',
  hoverColor: '#f0f0f0',
  activeColor: '#cce7ff',
};

export const defaultSettings: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  showGitBlame: true,
};

export function applyCSSVariables(theme: ThemeColors, fontSize: number) {
  const root = document.documentElement;

  root.style.setProperty('--bg-primary', theme.bgPrimary);
  root.style.setProperty('--bg-secondary', theme.bgSecondary);
  root.style.setProperty('--text-primary', theme.textPrimary);
  root.style.setProperty('--text-secondary', theme.textSecondary);
  root.style.setProperty('--border-color', theme.borderColor);
  root.style.setProperty('--accent-color', theme.accentColor);
  root.style.setProperty('--hover-color', theme.hoverColor);
  root.style.setProperty('--active-color', theme.activeColor);
  root.style.setProperty('--font-size-base', `${fontSize}px`);
}

export function getThemeColors(settings: AppSettings): ThemeColors {
  switch (settings.theme) {
    case 'light':
      return lightTheme;
    case 'custom':
      return settings.customTheme || darkTheme;
    case 'dark':
    default:
      return darkTheme;
  }
}

export function validateFontSize(size: number): number {
  return Math.max(12, Math.min(24, size));
}

export function adjustFontSize(currentSize: number, delta: number): number {
  return validateFontSize(currentSize + delta);
}