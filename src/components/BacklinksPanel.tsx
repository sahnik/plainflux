import React from 'react';
import { Link, ExternalLink } from 'lucide-react';

interface BacklinksPanelProps {
  backlinks: string[];
  outgoingLinks: string[];
  onBacklinkClick: (path: string) => void;
  onOutgoingLinkClick: (linkName: string) => void;
}

export const BacklinksPanel: React.FC<BacklinksPanelProps> = ({
  backlinks,
  outgoingLinks,
  onBacklinkClick,
  onOutgoingLinkClick
}) => {
  return (
    <div className="backlinks-panel">
      {/* Backlinks Section */}
      <div className="panel-section">
        <div className="panel-header">
          <Link size={16} />
          <span>Backlinks</span>
        </div>

        {backlinks.length === 0 ? (
          <div className="backlinks-empty">No backlinks found</div>
        ) : (
          <div className="backlinks-list">
            {backlinks.map((path) => {
              // Split on both forward slashes and backslashes to handle Windows paths
              const filename = path.split(/[/\\]/).pop()?.replace('.md', '') || path;
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

      {/* Outgoing Links Section */}
      <div className="panel-section">
        <div className="panel-header">
          <ExternalLink size={16} />
          <span>Outgoing Links</span>
        </div>

        {outgoingLinks.length === 0 ? (
          <div className="backlinks-empty">No outgoing links found</div>
        ) : (
          <div className="backlinks-list">
            {outgoingLinks.map((linkName, index) => (
              <div
                key={`${linkName}-${index}`}
                className="backlink-item"
                onClick={() => onOutgoingLinkClick(linkName)}
              >
                {linkName}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};