import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { tauriApi, AppSettings as TauriAppSettings } from '../api/tauri';
import { AppSettings, ThemeColors, getThemeColors, applyCSSVariables, defaultSettings } from '../utils/themes';

interface ThemeContextType {
  settings: AppSettings;
  colors: ThemeColors;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [colors, setColors] = useState<ThemeColors>(getThemeColors(defaultSettings));
  const [isLoading, setIsLoading] = useState(true);

  // Apply theme whenever settings change
  useEffect(() => {
    const newColors = getThemeColors(settings);
    setColors(newColors);
    applyCSSVariables(newColors, settings.fontSize);
  }, [settings]);

  const convertFromTauriSettings = useCallback((tauriSettings: TauriAppSettings): AppSettings => {
    return {
      theme: tauriSettings.theme as 'dark' | 'light' | 'custom',
      fontSize: tauriSettings.font_size,
      showGitBlame: tauriSettings.show_git_blame,
      customTheme: tauriSettings.custom_theme ? {
        bgPrimary: tauriSettings.custom_theme.bg_primary,
        bgSecondary: tauriSettings.custom_theme.bg_secondary,
        textPrimary: tauriSettings.custom_theme.text_primary,
        textSecondary: tauriSettings.custom_theme.text_secondary,
        borderColor: tauriSettings.custom_theme.border_color,
        accentColor: tauriSettings.custom_theme.accent_color,
        hoverColor: tauriSettings.custom_theme.hover_color,
        activeColor: tauriSettings.custom_theme.active_color,
      } : undefined,
      windowWidth: tauriSettings.window_width,
      windowHeight: tauriSettings.window_height,
      windowX: tauriSettings.window_x,
      windowY: tauriSettings.window_y,
      windowMaximized: tauriSettings.window_maximized,
    };
  }, []);

  const convertToTauriSettings = useCallback((settings: AppSettings): TauriAppSettings => {
    return {
      theme: settings.theme,
      font_size: settings.fontSize,
      show_git_blame: settings.showGitBlame,
      custom_theme: settings.customTheme ? {
        bg_primary: settings.customTheme.bgPrimary,
        bg_secondary: settings.customTheme.bgSecondary,
        text_primary: settings.customTheme.textPrimary,
        text_secondary: settings.customTheme.textSecondary,
        border_color: settings.customTheme.borderColor,
        accent_color: settings.customTheme.accentColor,
        hover_color: settings.customTheme.hoverColor,
        active_color: settings.customTheme.activeColor,
      } : undefined,
      window_width: settings.windowWidth,
      window_height: settings.windowHeight,
      window_x: settings.windowX,
      window_y: settings.windowY,
      window_maximized: settings.windowMaximized,
    };
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const savedSettings = await tauriApi.getAppSettings();
      setSettings(convertFromTauriSettings(savedSettings));
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  }, [convertFromTauriSettings]);

  // Load settings on mount
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    try {
      await tauriApi.saveAppSettings(convertToTauriSettings(updatedSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
      // Revert on error
      setSettings(settings);
      throw error;
    }
  };

  const value: ThemeContextType = {
    settings,
    colors,
    updateSettings,
    isLoading,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
