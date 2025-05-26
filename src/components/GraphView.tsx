import React, { useEffect, useRef } from 'react';
import VisGraph from 'react-vis-graph-wrapper';
import { Network as VisNetwork } from 'vis-network';
import './GraphView.css';

interface GraphNode {
  id: string;
  label: string;
  title: string;
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
}

export const GraphView: React.FC<GraphViewProps> = ({ data, onNodeClick, isLocal = false }) => {
  const networkRef = useRef<VisNetwork | null>(null);

  const options = {
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
        gravitationalConstant: -2000,
        centralGravity: 0.3,
        springLength: 95,
        springConstant: 0.04,
        damping: 0.09,
        avoidOverlap: 0.1,
      },
      stabilization: {
        enabled: true,
        iterations: 1000,
        updateInterval: 100,
      },
    },
    nodes: {
      shape: 'dot',
      size: 16,
      font: {
        size: 14,
        color: '#e0e0e0',
      },
      borderWidth: 2,
      color: {
        background: '#4a9eff',
        border: '#357abd',
        highlight: {
          background: '#6bb6ff',
          border: '#4a9eff',
        },
      },
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
      hideEdgesOnDrag: true,
      hideEdgesOnZoom: true,
    },
  };

  const events = {
    click: (event: any) => {
      const { nodes } = event;
      if (nodes.length > 0) {
        onNodeClick(nodes[0]);
      }
    },
  };

  useEffect(() => {
    if (networkRef.current && isLocal && data.nodes.length > 0) {
      // Focus on the current note for local graph
      setTimeout(() => {
        networkRef.current?.focus(data.nodes[0].id, {
          scale: 1.5,
          animation: {
            duration: 500,
            easingFunction: 'easeInOutQuad',
          },
        });
      }, 500);
    }
  }, [data, isLocal]);

  const getNetwork = (network: VisNetwork) => {
    networkRef.current = network;
  };

  return (
    <div className="graph-view-container">
      <div className="graph-header">
        <h3>{isLocal ? 'Local Graph' : 'Global Graph'}</h3>
        <span className="graph-stats">
          {data.nodes.length} notes, {data.edges.length} connections
        </span>
      </div>
      <div className="graph-canvas">
        <VisGraph
          graph={data}
          options={options}
          events={events}
          getNetwork={getNetwork}
        />
      </div>
    </div>
  );
};