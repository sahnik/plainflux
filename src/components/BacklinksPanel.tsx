import React, { useState } from 'react';
import { Link, ExternalLink } from 'lucide-react';

interface BacklinksPanelProps {
  backlinks: string[];
  outgoingLinks: string[];
  onBacklinkClick: (path: string) => void;
  onBacklinkOpenInNewTab: (path: string) => void;
  onOutgoingLinkClick: (linkName: string) => void;
  onOutgoingLinkOpenInNewTab: (linkName: string) => void;
}

export const BacklinksPanel: React.FC<BacklinksPanelProps> = ({
  backlinks,
  outgoingLinks,
  onBacklinkClick,
  onBacklinkOpenInNewTab,
  onOutgoingLinkClick,
  onOutgoingLinkOpenInNewTab
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'backlink' | 'outgoing';
    item: string;
  } | null>(null);

  // Close context menu on click outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);
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
                  onMouseDown={(e) => {
                    // Middle mouse button - open in new tab
                    if (e.button === 1) {
                      e.preventDefault();
                      e.stopPropagation();
                      onBacklinkOpenInNewTab(path);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      type: 'backlink',
                      item: path
                    });
                  }}
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
                onMouseDown={(e) => {
                  // Middle mouse button - open in new tab
                  if (e.button === 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    onOutgoingLinkOpenInNewTab(linkName);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: 'outgoing',
                    item: linkName
                  });
                }}
              >
                {linkName}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000
          }}
        >
          <button
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              if (contextMenu.type === 'backlink') {
                onBacklinkOpenInNewTab(contextMenu.item);
              } else {
                onOutgoingLinkOpenInNewTab(contextMenu.item);
              }
              setContextMenu(null);
            }}
          >
            <ExternalLink size={14} />
            <span>Open in New Tab</span>
          </button>
        </div>
      )}
    </div>
  );
};