import React, { useState, useEffect } from 'react';
import { X, Save, HelpCircle } from 'lucide-react';
import { tauriApi } from '../api/tauri';
import './TemplateSettings.css';

interface TemplateSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TemplateSettings: React.FC<TemplateSettingsProps> = ({ isOpen, onClose }) => {
  const [template, setTemplate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTemplate();
    }
  }, [isOpen]);

  const loadTemplate = async () => {
    setIsLoading(true);
    try {
      const currentTemplate = await tauriApi.getDailyNoteTemplate();
      setTemplate(currentTemplate);
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTemplate = async () => {
    setIsSaving(true);
    try {
      await tauriApi.saveDailyNoteTemplate(template);
      onClose();
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefault = () => {
    setTemplate("# {{date}}\n\n## Tasks\n- [ ] \n\n## Notes\n\n## Reflections\n\n");
  };

  if (!isOpen) return null;

  return (
    <div className="template-overlay">
      <div className="template-dialog">
        <div className="template-header">
          <h3>Daily Note Template</h3>
          <div className="template-header-buttons">
            <button
              className="template-help-button"
              onClick={() => setShowHelp(!showHelp)}
              title="Template Variables"
            >
              <HelpCircle size={18} />
            </button>
            <button
              className="template-close-button"
              onClick={onClose}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {showHelp && (
          <div className="template-help">
            <h4>Available Variables:</h4>
            <div className="template-variables">
              <div className="template-variable">
                <code>{'{{date}}'}</code> - Current date (YYYY-MM-DD)
              </div>
              <div className="template-variable">
                <code>{'{{date_long}}'}</code> - Full date (Monday, January 1, 2024)
              </div>
              <div className="template-variable">
                <code>{'{{time}}'}</code> - Current time (HH:MM)
              </div>
              <div className="template-variable">
                <code>{'{{datetime}}'}</code> - Date and time (YYYY-MM-DD HH:MM)
              </div>
              <div className="template-variable">
                <code>{'{{year}}'}</code> - Current year
              </div>
              <div className="template-variable">
                <code>{'{{month}}'}</code> - Current month (MM)
              </div>
              <div className="template-variable">
                <code>{'{{day}}'}</code> - Current day (DD)
              </div>
              <div className="template-variable">
                <code>{'{{weekday}}'}</code> - Day of week (Monday)
              </div>
            </div>
          </div>
        )}

        <div className="template-content">
          <label className="template-label">
            Template Content:
          </label>
          <textarea
            className="template-textarea"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="Enter your daily note template here..."
            rows={15}
            disabled={isLoading}
          />
        </div>

        <div className="template-actions">
          <button
            className="template-button template-button-secondary"
            onClick={resetToDefault}
            disabled={isLoading || isSaving}
          >
            Reset to Default
          </button>
          <div className="template-actions-right">
            <button
              className="template-button template-button-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              className="template-button template-button-primary"
              onClick={saveTemplate}
              disabled={isLoading || isSaving}
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};