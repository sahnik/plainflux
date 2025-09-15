import { useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { adjustFontSize } from '../utils/themes';

export function useKeyboardShortcuts() {
  const { settings, updateSettings } = useTheme();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      const cmdOrCtrl = event.metaKey || event.ctrlKey;

      if (!cmdOrCtrl) return;

      switch (event.key) {
        case '=':
        case '+':
          // Increase font size
          event.preventDefault();
          const increasedSize = adjustFontSize(settings.fontSize, 1);
          updateSettings({ fontSize: increasedSize });
          break;

        case '-':
        case '_':
          // Decrease font size
          event.preventDefault();
          const decreasedSize = adjustFontSize(settings.fontSize, -1);
          updateSettings({ fontSize: decreasedSize });
          break;

        case '0':
          // Reset font size to default
          event.preventDefault();
          updateSettings({ fontSize: 14 });
          break;

        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [settings.fontSize, updateSettings]);
}