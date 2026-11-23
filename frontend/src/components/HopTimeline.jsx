import React, { useState } from 'react';

export default function HopTimeline({ hops, selectedNodeId, onSelectNode }) {
  const [expandedHops, setExpandedHops] = useState({});

  const toggleHop = (nodeId) => {
    setExpandedHops(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  if (!hops || hops.length === 0) {
    return null;
  }

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '10px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
    }}>
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
            Hop Execution & Evidence
          </h3>
        </div>
        <span style={{
          fontSize: '11.5px',
          background: '#f1f5f9',
          color: '#475569',
          padding: '3px 8px',
          borderRadius: '6px',
          fontWeight: 600
        }}>
          {hops.length} Hops
        </span>
      </div>

      <div style={{ padding: '16px' }}>
        {hops.map((hop, idx) => {
          const isExpanded = expandedHops[hop.node_id] !== false; // default open
          const isSelected = selectedNodeId === hop.node_id;

          return (
            <div
              key={hop.node_id}
              style={{
                marginBottom: idx < hops.length - 1 ? '14px' : '0',
                background: isSelected ? '#f0f7ff' : '#ffffff',
                border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: '8px',
                overflow: 'hidden',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Hop Header */}
              <div
                onClick={() => {
                  toggleHop(hop.node_id);
                  onSelectNode && onSelectNode(hop.node_id);
                }}
                style={{
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: isSelected ? '#eff6ff' : '#f8fafc'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <span style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: '#2563eb',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700
                  }}>
                    {idx + 1}
                  </span>
                  <div>
                    <span style={{
                      fontSize: '11px',
                      color: '#2563eb',
                      fontWeight: 700,
                      marginRight: '6px'
                    }}>
                      [{hop.node_id.toUpperCase()}]
                    </span>
                    <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>
                      {hop.question}
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontSize: '11px',
                    color: '#64748b',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    padding: '2px 7px',
                    borderRadius: '4px'
                  }}>
                    {hop.retrieved_chunks?.length || 0} chunks
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {isExpanded ? 'Hide' : 'Show'}
                  </span>
                </div>
              </div>

              {/* Hop Details */}
              {isExpanded && (
                <div style={{ padding: '14px', borderTop: '1px solid #e2e8f0' }}>
                  {/* Contextualized Query */}
                  {hop.contextualized_query && hop.contextualized_query !== hop.question && (
                    <div style={{
                      marginBottom: '12px',
                      padding: '8px 12px',
                      background: '#eff6ff',
                      borderRadius: '6px',
                      borderLeft: '3px solid #2563eb'
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e40af', marginBottom: '2px' }}>
                        Context Injected:
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#1e293b' }}>
                        "{hop.contextualized_query}"
                      </div>
                    </div>
                  )}

                  {/* Intermediate Answer */}
                  <div style={{
                    marginBottom: '14px',
                    padding: '10px 12px',
                    background: '#f0fdf4',
                    borderRadius: '6px',
                    borderLeft: '3px solid #10b981'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', marginBottom: '2px' }}>
                      INTERMEDIATE RESULT:
                    </div>
                    <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: '1.5' }}>
                      {hop.answer}
                    </div>
                  </div>

                  {/* Retrieved Chunks List */}
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                      Retrieved Chunks ({hop.retrieved_chunks?.length || 0}):
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(hop.retrieved_chunks || []).map((chunk, cIdx) => (
                        <div
                          key={`${chunk.chunk_id}-${cIdx}`}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '8px 10px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#0f172a' }}>
                                {chunk.doc_name}
                              </span>
                              <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                                (Chunk #{chunk.chunk_index})
                              </span>
                            </div>
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 600,
                              color: chunk.score > 0.5 ? '#059669' : '#d97706',
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              padding: '1px 5px',
                              borderRadius: '4px'
                            }}>
                              {(chunk.score * 100).toFixed(1)}% match
                            </span>
                          </div>
                          <p style={{
                            fontSize: '12px',
                            color: '#334155',
                            lineHeight: '1.45',
                            whiteSpace: 'pre-wrap'
                          }}>
                            {chunk.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
