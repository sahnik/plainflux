import React from 'react';
import { Link } from 'lucide-react';

interface BacklinksPanelProps {
  backlinks: string[];
  onBacklinkClick: (path: string) => void;
}

export const BacklinksPanel: React.FC<BacklinksPanelProps> = ({ backlinks, onBacklinkClick }) => {
  return (
    <div className="backlinks-panel">
      <div className="panel-header">
        <Link size={16} />
        <span>Backlinks</span>
      </div>
      
      {backlinks.length === 0 ? (
        <div className="backlinks-empty">No backlinks found</div>
      ) : (
        <div className="backlinks-list">
          {backlinks.map((path) => {
            const filename = path.split('/').pop()?.replace('.md', '') || path;
            return (
              <div
                key={path}
                className="backlink-item"
                onClick={() => onBacklinkClick(path)}
              >
                {filename}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};