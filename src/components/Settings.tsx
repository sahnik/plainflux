import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Palette, Type, Code } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeColors, darkTheme, validateFontSize } from '../utils/themes';
import './Settings.css';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange }) => (
  <div className="color-picker-group">
    <label className="color-picker-label">{label}</label>
    <div className="color-picker-container">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="color-picker-input"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="color-picker-text"
        placeholder="#000000"
      />
    </div>
  </div>
);

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, isLoading } = useTheme();
  const [activeTab, setActiveTab] = useState<'appearance' | 'font' | 'editor'>('appearance');
  const [localSettings, setLocalSettings] = useState(settings);
  const [customTheme, setCustomTheme] = useState<ThemeColors>(
    settings.customTheme || darkTheme
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      setCustomTheme(settings.customTheme || darkTheme);
    }
  }, [isOpen, settings]);

  const handleThemeChange = (theme: 'dark' | 'light' | 'custom') => {
    setLocalSettings({ ...localSettings, theme });
  };

  const handleFontSizeChange = (fontSize: number) => {
    const validSize = validateFontSize(fontSize);
    setLocalSettings({ ...localSettings, fontSize: validSize });
  };

  const handleGitBlameToggle = (enabled: boolean) => {
    setLocalSettings({ ...localSettings, showGitBlame: enabled });
  };

  const handleCustomThemeChange = (updates: Partial<ThemeColors>) => {
    const newCustomTheme = { ...customTheme, ...updates };
    setCustomTheme(newCustomTheme);
    setLocalSettings({
      ...localSettings,
      theme: 'custom',
      customTheme: newCustomTheme
    });
  };

  const resetCustomTheme = () => {
    setCustomTheme(darkTheme);
    setLocalSettings({
      ...localSettings,
      customTheme: darkTheme
    });
  };

  const resetToDefaults = () => {
    setLocalSettings({
      theme: 'dark',
      fontSize: 14,
      showGitBlame: true,
    });
    setCustomTheme(darkTheme);
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await updateSettings(localSettings);
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-dialog">
        <div className="settings-header">
          <h3>Settings</h3>
          <button
            className="settings-close-button"
            onClick={onClose}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <Palette size={16} />
            Appearance
          </button>
          <button
            className={`settings-tab ${activeTab === 'font' ? 'active' : ''}`}
            onClick={() => setActiveTab('font')}
          >
            <Type size={16} />
            Font
          </button>
          <button
            className={`settings-tab ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            <Code size={16} />
            Editor
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'appearance' && (
            <div className="settings-section">
              <h4>Theme</h4>
              <div className="theme-options">
                <label className="theme-option">
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={localSettings.theme === 'dark'}
                    onChange={() => handleThemeChange('dark')}
                  />
                  <span className="theme-option-label">Dark</span>
                </label>
                <label className="theme-option">
                  <input
                    type="radio"
                    name="theme"
                    value="light"
                    checked={localSettings.theme === 'light'}
                    onChange={() => handleThemeChange('light')}
                  />
                  <span className="theme-option-label">Light</span>
                </label>
                <label className="theme-option">
                  <input
                    type="radio"
                    name="theme"
                    value="custom"
                    checked={localSettings.theme === 'custom'}
                    onChange={() => handleThemeChange('custom')}
                  />
                  <span className="theme-option-label">Custom</span>
                </label>
              </div>

              {localSettings.theme === 'custom' && (
                <div className="custom-theme-section">
                  <div className="custom-theme-header">
                    <h5>Custom Theme Colors</h5>
                    <button
                      className="reset-custom-button"
                      onClick={resetCustomTheme}
                      title="Reset to dark theme"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>
                  <div className="color-pickers">
                    <ColorPicker
                      label="Primary Background"
                      value={customTheme.bgPrimary}
                      onChange={(value) => handleCustomThemeChange({ bgPrimary: value })}
                    />
                    <ColorPicker
                      label="Secondary Background"
                      value={customTheme.bgSecondary}
                      onChange={(value) => handleCustomThemeChange({ bgSecondary: value })}
                    />
                    <ColorPicker
                      label="Primary Text"
                      value={customTheme.textPrimary}
                      onChange={(value) => handleCustomThemeChange({ textPrimary: value })}
                    />
                    <ColorPicker
                      label="Secondary Text"
                      value={customTheme.textSecondary}
                      onChange={(value) => handleCustomThemeChange({ textSecondary: value })}
                    />
                    <ColorPicker
                      label="Border Color"
                      value={customTheme.borderColor}
                      onChange={(value) => handleCustomThemeChange({ borderColor: value })}
                    />
                    <ColorPicker
                      label="Accent Color"
                      value={customTheme.accentColor}
                      onChange={(value) => handleCustomThemeChange({ accentColor: value })}
                    />
                    <ColorPicker
                      label="Hover Color"
                      value={customTheme.hoverColor}
                      onChange={(value) => handleCustomThemeChange({ hoverColor: value })}
                    />
                    <ColorPicker
                      label="Active Color"
                      value={customTheme.activeColor}
                      onChange={(value) => handleCustomThemeChange({ activeColor: value })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'font' && (
            <div className="settings-section">
              <h4>Font Size</h4>
              <div className="font-size-control">
                <label htmlFor="font-size-slider">Size: {localSettings.fontSize}px</label>
                <div className="font-size-slider-container">
                  <input
                    id="font-size-slider"
                    type="range"
                    min="12"
                    max="24"
                    value={localSettings.fontSize}
                    onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
                    className="font-size-slider"
                  />
                  <div className="font-size-markers">
                    <span>12</span>
                    <span>16</span>
                    <span>20</span>
                    <span>24</span>
                  </div>
                </div>
                <div className="font-size-buttons">
                  <button
                    className="font-size-button"
                    onClick={() => handleFontSizeChange(localSettings.fontSize - 1)}
                    disabled={localSettings.fontSize <= 12}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="12"
                    max="24"
                    value={localSettings.fontSize}
                    onChange={(e) => handleFontSizeChange(parseInt(e.target.value) || 14)}
                    className="font-size-input"
                  />
                  <button
                    className="font-size-button"
                    onClick={() => handleFontSizeChange(localSettings.fontSize + 1)}
                    disabled={localSettings.fontSize >= 24}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="font-preview">
                <h5>Preview</h5>
                <div
                  className="font-preview-text"
                  style={{ fontSize: `${localSettings.fontSize}px` }}
                >
                  The quick brown fox jumps over the lazy dog.<br />
                  <code>// Code example: function hello() {}</code>
                </div>
              </div>

              <div className="keyboard-shortcuts">
                <h5>Keyboard Shortcuts</h5>
                <div className="shortcut-list">
                  <div className="shortcut-item">
                    <span className="shortcut-keys">Cmd/Ctrl + =</span>
                    <span>Increase font size</span>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-keys">Cmd/Ctrl + -</span>
                    <span>Decrease font size</span>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-keys">Cmd/Ctrl + 0</span>
                    <span>Reset to default size</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="settings-section">
              <h4>Git Integration</h4>
              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={localSettings.showGitBlame}
                    onChange={(e) => handleGitBlameToggle(e.target.checked)}
                    className="setting-checkbox"
                  />
                  <span className="setting-text">Show Git Blame Information</span>
                </label>
                <p className="setting-description">
                  Display author and commit information inline in the editor.
                  Requires a Git repository to be initialized.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="settings-actions">
          <button
            className="settings-button settings-button-secondary"
            onClick={resetToDefaults}
            disabled={isLoading || isSaving}
          >
            Reset All
          </button>
          <div className="settings-actions-right">
            <button
              className="settings-button settings-button-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              className="settings-button settings-button-primary"
              onClick={saveSettings}
              disabled={isLoading || isSaving}
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};