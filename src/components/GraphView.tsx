import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import VisGraph from 'react-vis-graph-wrapper';
import { Network as VisNetwork } from 'vis-network';
import { Search, ZoomIn, ZoomOut, Maximize2, Focus } from 'lucide-react';
import './GraphView.css';

interface GraphNode {
  id: string;
  label: string;
  title: string;
  connectionCount: number;
  isCenter: boolean;
}

interface GraphEdge {
  from: string;
  to: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphViewProps {
  data: GraphData;
  onNodeClick: (nodeId: string) => void;
  isLocal?: boolean;
  // For filtered graph mode
  searchTerm?: string;
  maxHops?: number;
  onSearchChange?: (term: string) => void;
  onMaxHopsChange?: (hops: number) => void;
  onFocusCurrentNote?: () => void;
  currentNotePath?: string;
  currentNoteTitle?: string;
}

// Calculate node size based on connection count
const calculateNodeSize = (connectionCount: number, maxConnections: number): number => {
  const minSize = 12;
  const maxSize = 40;
  if (maxConnections <= 1) return minSize;
  const normalized = connectionCount / maxConnections;
  return minSize + (maxSize - minSize) * Math.sqrt(normalized);
};

export const GraphView: React.FC<GraphViewProps> = ({
  data,
  onNodeClick,
  isLocal = false,
  searchTerm = '',
  maxHops = 2,
  onSearchChange,
  onMaxHopsChange,
  onFocusCurrentNote,
  currentNotePath,
  currentNoteTitle,
}) => {
  const networkRef = useRef<VisNetwork | null>(null);
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);

  // Calculate max connections for sizing
  const maxConnections = useMemo(() => {
    return Math.max(1, ...data.nodes.map(n => n.connectionCount));
  }, [data.nodes]);

  // Transform nodes with dynamic sizing
  const transformedData = useMemo(() => {
    const nodes = data.nodes.map(node => {
      const size = calculateNodeSize(node.connectionCount, maxConnections);
      return {
        id: node.id,
        label: node.label,
        title: `${node.title}\n${node.connectionCount} connection${node.connectionCount !== 1 ? 's' : ''}`,
        size,
        color: node.isCenter ? {
          background: '#ff9f43',
          border: '#e17055',
          highlight: { background: '#ffc048', border: '#ff9f43' },
        } : {
          background: '#4a9eff',
          border: '#357abd',
          highlight: { background: '#6bb6ff', border: '#4a9eff' },
        },
        font: {
          size: Math.max(10, Math.min(16, size * 0.6)),
          color: '#e0e0e0',
        },
      };
    });
    return { nodes, edges: data.edges };
  }, [data, maxConnections]);

  // Adjust physics based on graph size
  const options = useMemo(() => {
    const nodeCount = data.nodes.length;
    const iterations = nodeCount > 100 ? 300 : nodeCount > 50 ? 500 : 1000;

    return {
      layout: {
        improvedLayout: true,
        hierarchical: false,
      },
      autoResize: true,
      height: '100%',
      width: '100%',
      physics: {
        enabled: true,
        barnesHut: {
          gravitationalConstant: nodeCount > 50 ? -3000 : -2000,
          centralGravity: 0.3,
          springLength: nodeCount > 50 ? 120 : 95,
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 0.2,
        },
        stabilization: {
          enabled: true,
          iterations,
          updateInterval: 50,
        },
      },
      nodes: {
        shape: 'dot',
        borderWidth: 2,
      },
      edges: {
        width: 1,
        color: {
          color: '#666666',
          highlight: '#4a9eff',
        },
        arrows: {
          to: {
            enabled: true,
            scaleFactor: 0.5,
          },
        },
        smooth: {
          enabled: true,
          type: 'continuous',
          roundness: 0.5,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        hideEdgesOnDrag: nodeCount > 50,
        hideEdgesOnZoom: nodeCount > 50,
        zoomView: true,
        dragView: true,
      },
    };
  }, [data.nodes.length]);

  const events = {
    click: (event: { nodes: string[] }) => {
      const { nodes } = event;
      if (nodes.length > 0) {
        onNodeClick(nodes[0]);
      }
    },
  };

  useEffect(() => {
    if (networkRef.current && data.nodes.length > 0) {
      // Find center node to focus on
      const centerNode = data.nodes.find(n => n.isCenter);
      if (centerNode) {
        setTimeout(() => {
          networkRef.current?.focus(centerNode.id, {
            scale: 1.2,
            animation: {
              duration: 500,
              easingFunction: 'easeInOutQuad',
            },
          });
        }, 500);
      }
    }
  }, [data]);

  const getNetwork = (network: VisNetwork) => {
    networkRef.current = network;
  };

  const handleZoomIn = useCallback(() => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 1.3 });
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale / 1.3 });
    }
  }, []);

  const handleFit = useCallback(() => {
    if (networkRef.current) {
      networkRef.current.fit({
        animation: {
          duration: 500,
          easingFunction: 'easeInOutQuad',
        },
      });
    }
  }, []);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchChange) {
      onSearchChange(localSearchTerm);
    }
  }, [localSearchTerm, onSearchChange]);

  const handleFocusCurrent = useCallback(() => {
    if (onFocusCurrentNote) {
      onFocusCurrentNote();
    }
  }, [onFocusCurrentNote]);

  const showControls = !isLocal && onSearchChange;

  return (
    <div className="graph-view-container">
      <div className="graph-header">
        <h3>{isLocal ? 'Local Graph' : 'Knowledge Graph'}</h3>
        <span className="graph-stats">
          {data.nodes.length} notes, {data.edges.length} connections
        </span>
      </div>

      {showControls && (
        <div className="graph-controls">
          <form className="graph-search-form" onSubmit={handleSearchSubmit}>
            <div className="graph-search-input-wrapper">
              <Search size={14} className="graph-search-icon" />
              <input
                type="text"
                className="graph-search-input"
                placeholder="Search notes..."
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={maxHops}
              onChange={(e) => onMaxHopsChange?.(Number(e.target.value))}
              className="graph-hop-select"
              title="Connection depth"
            >
              <option value={1}>1 hop</option>
              <option value={2}>2 hops</option>
              <option value={3}>3 hops</option>
              <option value={4}>4 hops</option>
              <option value={5}>5 hops</option>
            </select>
            {currentNotePath && (
              <button
                type="button"
                className="graph-focus-btn"
                onClick={handleFocusCurrent}
                title={`Focus on: ${currentNoteTitle || 'current note'}`}
              >
                <Focus size={14} />
              </button>
            )}
          </form>
        </div>
      )}

      <div className="graph-toolbar">
        <button onClick={handleZoomIn} title="Zoom In" className="graph-toolbar-btn">
          <ZoomIn size={14} />
        </button>
        <button onClick={handleZoomOut} title="Zoom Out" className="graph-toolbar-btn">
          <ZoomOut size={14} />
        </button>
        <button onClick={handleFit} title="Fit to View" className="graph-toolbar-btn">
          <Maximize2 size={14} />
        </button>
      </div>

      <div className="graph-canvas">
        {data.nodes.length === 0 ? (
          <div className="graph-empty">
            {showControls ? (
              <>
                <Search size={48} strokeWidth={1} />
                <p>Search for a note to explore its connections</p>
                <p className="graph-empty-hint">
                  Use the search box above, or click "Focus Current" to start from your open note
                </p>
              </>
            ) : (
              <p>No connections to display</p>
            )}
          </div>
        ) : (
          <VisGraph
            graph={transformedData}
            options={options}
            events={events}
            getNetwork={getNetwork}
          />
        )}
      </div>

      {data.nodes.length > 0 && (
        <div className="graph-legend">
          <div className="graph-legend-item">
            <span className="graph-legend-dot graph-legend-dot-center" />
            <span>Search match / Focus</span>
          </div>
          <div className="graph-legend-item">
            <span className="graph-legend-dot graph-legend-dot-connected" />
            <span>Connected notes</span>
          </div>
          <div className="graph-legend-item">
            <span className="graph-legend-size-hint">Node size = connection count</span>
          </div>
        </div>
      )}
    </div>
  );
};
