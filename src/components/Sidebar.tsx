import React from 'react';
import { FileText, Hash, Search, Calendar } from 'lucide-react';
import { ViewType } from '../types';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onDailyNote: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, onDailyNote }) => {
  const iconSize = 20;
  
  return (
    <div className="sidebar">
      <button
        className={`sidebar-icon ${currentView === 'notes' ? 'active' : ''}`}
        onClick={() => onViewChange('notes')}
        title="Notes"
      >
        <FileText size={iconSize} />
      </button>
      
      <button
        className={`sidebar-icon ${currentView === 'tags' ? 'active' : ''}`}
        onClick={() => onViewChange('tags')}
        title="Tags"
      >
        <Hash size={iconSize} />
      </button>
      
      <button
        className={`sidebar-icon ${currentView === 'search' ? 'active' : ''}`}
        onClick={() => onViewChange('search')}
        title="Search"
      >
        <Search size={iconSize} />
      </button>
      
      <div className="sidebar-spacer" />
      
      <button
        className="sidebar-icon"
        onClick={onDailyNote}
        title="Daily Note"
      >
        <Calendar size={iconSize} />
      </button>
    </div>
  );
};