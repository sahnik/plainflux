import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface InputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
  cancelText?: string;
}

export const InputDialog: React.FC<InputDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  label,
  placeholder = '',
  initialValue = '',
  confirmText = 'Create',
  cancelText = 'Cancel'
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      // Focus the input after the dialog is rendered
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isOpen, initialValue]);

  const handleConfirm = () => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      onConfirm(trimmedValue);
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{title}</h3>
          <button className="dialog-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="dialog-content">
          <label className="input-label">{label}</label>
          <input
            ref={inputRef}
            type="text"
            className="input-field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
          />
        </div>
        <div className="dialog-actions">
          <button className="dialog-button cancel" onClick={onClose}>
            {cancelText}
          </button>
          <button 
            className="dialog-button confirm-button-primary" 
            onClick={handleConfirm}
            disabled={!value.trim()}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};