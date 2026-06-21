'use client';

// ============================================================================
// EgBE Memory Engine — Knowledge Graph Page
//
// Explore concept nodes and their relationships (prerequisites, applications,
// analogies). Impeccable.style brutalist UI — no rounded corners, no soft
import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { initDb } from '@/lib/db';
import { KnowledgeGraph } from '@/lib/knowledge-graph';
import type { ConceptNode, ConceptEdge, UUID } from '@/types/schema';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

export default function GraphPage() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [selectedId, setSelectedId] = useState<UUID | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const db = await initDb();
      const nodes = await db.conceptNodes.toArray();
      const edges = await db.conceptEdges.toArray();
      const kg = new KnowledgeGraph(nodes, edges);
      setGraph(kg);
    })();
  }, []);

  const allNodes = graph ? graph.getAllNodes() : [];
  const allEdges = graph ? graph.getAllEdges() : [];

  const filteredNodes = useMemo(() => {
    if (!search) return allNodes;
    const lowerSearch = search.toLowerCase();
    return allNodes.filter(
      (n) =>
        n.title_en.toLowerCase().includes(lowerSearch) ||
        (n.title_th && n.title_th.includes(search)),
    );
  }, [allNodes, search]);

  const filteredEdges = useMemo(() => {
    if (!search) return allEdges;
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return allEdges.filter(e => nodeIds.has(e.source_id) && nodeIds.has(e.target_id));
  }, [allEdges, filteredNodes, search]);

  const eChartsOption = useMemo(() => {
    if (!graph) return {};
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (params.dataType === 'node') {
            return `<strong>${params.data.name}</strong><br/>${params.data.domain || ''}`;
          }
          if (params.dataType === 'edge') {
            return `<strong>${params.data.relationship}</strong><br/>Strength: ${params.data.strength}`;
          }
          return '';
        },
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: 'rgba(26,19,9,0.08)',
        textStyle: {
          color: '#1A1309',
          fontFamily: '"Inter", sans-serif',
          fontSize: 12
        },
        padding: [8, 12]
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roaming: true,
          label: {
            show: true,
            position: 'right',
            formatter: '{b}',
            fontSize: 10,
            fontFamily: '"Inter", sans-serif',
            color: '#6A5C4E'
          },
          force: {
            repulsion: 300,
            edgeLength: 100,
            gravity: 0.1
          },
          data: filteredNodes.map((n) => ({
            id: n.id,
            name: n.title_en,
            value: n.importance || 1,
            domain: n.domain,
            symbolSize: (n.importance || 1) * 8 + 10,
            itemStyle: {
              color: selectedId === n.id ? '#0d9488' : '#e5e1d8',
              borderColor: selectedId === n.id ? '#0f766e' : '#d4cfc4',
              borderWidth: 1,
              shadowColor: 'rgba(0,0,0,0.1)',
              shadowBlur: selectedId === n.id ? 10 : 0
            },
            label: {
              fontWeight: selectedId === n.id ? 700 : 400,
              color: selectedId === n.id ? '#1A1309' : '#8A7F72'
            }
          })),
          edges: filteredEdges.map((e) => ({
            source: e.source_id,
            target: e.target_id,
            relationship: e.relationship,
            strength: e.strength,
            lineStyle: {
              color: '#d4cfc4',
              width: Math.max(1, e.strength * 3),
              curveness: 0.2,
              opacity: 0.6
            }
          })),
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              width: 3,
              color: '#d97706'
            }
          }
        }
      ]
    };
  }, [graph, filteredNodes, filteredEdges, selectedId]);

  if (!graph) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#FDFBF7', color: '#1A1309', fontFamily: '"Inter", sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '0.75rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.1em', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
          Loading graph...
        </p>
      </div>
    );
  }

  const selectedNode = selectedId ? graph.getNode(selectedId) : null;
  const bfsPath = selectedId ? graph.bfs(selectedId, 3) : null;
  const prereqs = selectedId ? graph.getPrerequisites(selectedId, 3) : null;
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  // Unique edge types
  const edgeTypes = new Set(allEdges.map((e) => e.relationship));

  const onChartEvents = {
    click: (params: any) => {
      if (params.dataType === 'node') {
        setSelectedId(params.data.id);
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FDFBF7', color: '#1A1309', fontFamily: '"Inter", sans-serif' }}>
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '3rem 1rem' }}>
        {/* Header */}
        <div style={{ borderBottom: '1px solid rgba(26,19,9,0.08)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: '#1A1309', fontFamily: '"Fraunces", serif', letterSpacing: '-0.02em', margin: 0 }}>
            Knowledge Graph
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6A5C4E', marginTop: '0.25rem' }}>
            Concept relationships — prerequisites, applications, and analogies
            across biomedical engineering.
          </p>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1px', marginBottom: '2rem', backgroundColor: 'rgba(26,19,9,0.08)', border: '1px solid rgba(26,19,9,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0d9488', fontFamily: '"Fraunces", serif', fontFeatureSettings: '"tnum"' }}>{allNodes.length}</p>
            <p style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem', fontWeight: 600 }}>Concepts</p>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1309', fontFamily: '"Fraunces", serif', fontFeatureSettings: '"tnum"' }}>{allEdges.length}</p>
            <p style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem', fontWeight: 600 }}>Relationships</p>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#6A5C4E', fontFamily: '"Fraunces", serif', fontFeatureSettings: '"tnum"' }}>{edgeTypes.size}</p>
            <p style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem', fontWeight: 600 }}>Edge Types</p>
          </div>
        </div>

        {/* Layout: Main Graph + Sidebar Detail */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }} className="lg:grid-cols-3">
          {/* Main — Knowledge Graph Visualization */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid rgba(26,19,9,0.08)', backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', padding: '1rem' }} className="lg:col-span-2">
            <ReactECharts
              option={eChartsOption}
              onEvents={onChartEvents}
              style={{ height: '600px', width: '100%' }}
              opts={{ renderer: 'canvas' }}
            />
          </div>

          {/* Sidebar — Selected node detail + relations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="lg:col-span-1">
            {!selectedNode ? (
              <div style={{ border: '1px dashed rgba(26,19,9,0.2)', backgroundColor: 'transparent', padding: '3rem', textAlign: 'center', borderRadius: '12px' }}>
                <p style={{ fontSize: '0.75rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                  Select a concept to explore its relationships
                </p>
              </div>
            ) : (
              <>
                {/* Node detail card */}
                <div style={{ border: '1px solid rgba(26,19,9,0.08)', backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(26,19,9,0.05)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1A1309', textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
                        {selectedNode.title_en}
                      </h2>
                      {selectedNode.title_th && (
                        <p style={{ fontSize: '0.875rem', color: '#8A7F72', marginTop: '0.25rem' }}>{selectedNode.title_th}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                      {selectedNode.domain && (
                        <span style={{ fontSize: '0.65rem', color: '#0d9488', border: '1px solid rgba(13,148,136,0.3)', backgroundColor: 'rgba(13,148,136,0.05)', padding: '0.15rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: '4px', fontWeight: 600 }}>
                          {selectedNode.domain}
                        </span>
                      )}
                      {selectedNode.importance && (
                        <span style={{ fontSize: '0.65rem', color: '#6A5C4E', border: '1px solid rgba(26,19,9,0.15)', backgroundColor: '#FDFBF7', padding: '0.15rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: '4px', fontWeight: 600 }}>
                          Lv.{selectedNode.importance}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedNode.description_en && (
                    <p style={{ padding: '1rem 1.25rem', fontSize: '0.875rem', color: '#6A5C4E', lineHeight: 1.6 }}>
                      {selectedNode.description_en}
                    </p>
                  )}
                </div>

                {/* Outgoing edges */}
                <div>
                  <h3 style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '0.75rem', borderBottom: '1px solid rgba(26,19,9,0.08)', paddingBottom: '0.5rem' }}>
                    Forward Connections ({graph.getOutgoingEdges(selectedNode.id).length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {graph.getOutgoingEdges(selectedNode.id).map((edge) => {
                      const target = nodeMap.get(edge.target_id);
                      return (
                        <button
                          key={edge.id}
                          onClick={() => setSelectedId(edge.target_id)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            border: '1px solid rgba(26,19,9,0.08)',
                            backgroundColor: '#FFFFFF',
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(13,148,136,0.3)';
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 8px rgba(0,0,0,0.03)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.08)';
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 4px rgba(0,0,0,0.01)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', color: '#1A1309', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {target?.title_en || edge.target_id}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                              <span style={{ fontSize: '0.65rem', color: '#6A5C4E', border: '1px solid rgba(26,19,9,0.15)', padding: '0.1rem 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: '4px' }}>
                                {edge.relationship}
                              </span>
                              <span style={{ fontSize: '0.65rem', color: '#8A7F72', fontFamily: 'monospace', fontFeatureSettings: '"tnum"' }}>
                                {edge.strength.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {graph.getOutgoingEdges(selectedNode.id).length === 0 && (
                      <p style={{ fontSize: '0.75rem', color: '#8A7F72', padding: '0.5rem 0.25rem' }}>No outgoing connections.</p>
                    )}
                  </div>
                </div>

                {/* Incoming edges */}
                <div>
                  <h3 style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '0.75rem', borderBottom: '1px solid rgba(26,19,9,0.08)', paddingBottom: '0.5rem' }}>
                    Incoming Connections ({graph.getIncomingEdges(selectedNode.id).length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {graph.getIncomingEdges(selectedNode.id).map((edge) => {
                      const source = nodeMap.get(edge.source_id);
                      return (
                        <button
                          key={edge.id}
                          onClick={() => setSelectedId(edge.source_id)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            border: '1px solid rgba(26,19,9,0.08)',
                            backgroundColor: '#FFFFFF',
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(217,119,6,0.3)';
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 8px rgba(0,0,0,0.03)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.08)';
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 4px rgba(0,0,0,0.01)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', color: '#1A1309', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {source?.title_en || edge.source_id}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                              <span style={{ fontSize: '0.65rem', color: '#6A5C4E', border: '1px solid rgba(26,19,9,0.15)', padding: '0.1rem 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: '4px' }}>
                                {edge.relationship}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {graph.getIncomingEdges(selectedNode.id).length === 0 && (
                      <p style={{ fontSize: '0.75rem', color: '#8A7F72', padding: '0.5rem 0.25rem' }}>No incoming connections.</p>
                    )}
                  </div>
                </div>

                {/* BFS Reachability */}
                {bfsPath && bfsPath.nodes.length > 1 && (
                  <div>
                    <h3 style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '0.75rem', borderBottom: '1px solid rgba(26,19,9,0.08)', paddingBottom: '0.5rem' }}>
                      Reachable within 3 hops (BFS)
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {bfsPath.nodes.slice(1).map((node) => (
                        <button
                          key={node.id}
                          onClick={() => setSelectedId(node.id)}
                          style={{
                            border: '1px solid rgba(26,19,9,0.15)',
                            backgroundColor: '#FFFFFF',
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.75rem',
                            color: '#6A5C4E',
                            borderRadius: '9999px',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = '#0d9488';
                            (e.currentTarget as HTMLElement).style.color = '#0d9488';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.15)';
                            (e.currentTarget as HTMLElement).style.color = '#6A5C4E';
                          }}
                        >
                          {node.title_en}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prerequisites */}
                {prereqs && prereqs.nodes.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '0.75rem', borderBottom: '1px solid rgba(26,19,9,0.08)', paddingBottom: '0.5rem' }}>
                      Prerequisites ({prereqs.nodes.length})
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {prereqs.nodes.map((node) => (
                        <button
                          key={node.id}
                          onClick={() => setSelectedId(node.id)}
                          style={{
                            border: '1px solid rgba(26,19,9,0.15)',
                            backgroundColor: '#FFFFFF',
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.75rem',
                            color: '#6A5C4E',
                            borderRadius: '9999px',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = '#d97706';
                            (e.currentTarget as HTMLElement).style.color = '#d97706';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.15)';
                            (e.currentTarget as HTMLElement).style.color = '#6A5C4E';
                          }}
                        >
                          {node.title_en}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}