import React from 'react';
import { X, FileText } from 'lucide-react';
import { Tab } from '../types';

interface TabBarProps {
  tabs: Tab[];
  activeTabIndex: number;
  onTabClick: (index: number) => void;
  onTabClose: (index: number) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ tabs, activeTabIndex, onTabClick, onTabClose }) => {
  const handleCloseClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    onTabClose(index);
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {tabs.map((tab, index) => (
          <div
            key={tab.note.path}
            className={`tab ${index === activeTabIndex ? 'active' : ''}`}
            onClick={() => onTabClick(index)}
            title={tab.note.path}
          >
            <FileText size={14} className="tab-icon" />
            <span className="tab-title">
              {tab.isDirty && <span className="tab-dirty">•</span>}
              {tab.note.title}
            </span>
            <button
              className="tab-close"
              onClick={(e) => handleCloseClick(e, index)}
              title="Close tab"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};