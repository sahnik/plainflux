import React from 'react';
import { FileText, Hash, Search, Calendar, Network, CheckSquare, HelpCircle, Settings, Clock } from 'lucide-react';
import { ViewType } from '../types';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onDailyNote: () => void;
  onHelp: () => void;
  onSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, onDailyNote, onHelp, onSettings }) => {
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
        className={`sidebar-icon ${currentView === 'recent' ? 'active' : ''}`}
        onClick={() => onViewChange('recent')}
        title="Recent Notes"
      >
        <Clock size={iconSize} />
      </button>

      <button
        className={`sidebar-icon ${currentView === 'search' ? 'active' : ''}`}
        onClick={() => onViewChange('search')}
        title="Search"
      >
        <Search size={iconSize} />
      </button>
      
      <button
        className={`sidebar-icon ${currentView === 'graph' ? 'active' : ''}`}
        onClick={() => onViewChange('graph')}
        title="Knowledge Graph"
      >
        <Network size={iconSize} />
      </button>
      
      <button
        className={`sidebar-icon ${currentView === 'todos' ? 'active' : ''}`}
        onClick={() => onViewChange('todos')}
        title="Tasks"
      >
        <CheckSquare size={iconSize} />
      </button>
      
      <div className="sidebar-spacer" />
      
      <button
        className="sidebar-icon"
        onClick={onDailyNote}
        title="Daily Note"
      >
        <Calendar size={iconSize} />
      </button>
      
      <button
        className="sidebar-icon"
        onClick={onSettings}
        title="Settings"
      >
        <Settings size={iconSize} />
      </button>
      
      <button
        className="sidebar-icon"
        onClick={onHelp}
        title="Help"
      >
        <HelpCircle size={iconSize} />
      </button>
    </div>
  );
};