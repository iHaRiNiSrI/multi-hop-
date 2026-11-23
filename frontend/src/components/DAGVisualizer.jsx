import React, { useState, useMemo } from 'react';

export default function DAGVisualizer({ plan, onSelectNode, selectedNodeId }) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const rawNodes = useMemo(() => {
    if (!plan) return [];
    if (plan.hops && plan.hops.length > 0) return plan.hops;
    if (plan.nodes && plan.nodes.length > 0) return plan.nodes;
    return [];
  }, [plan]);

  if (!plan || rawNodes.length === 0) {
    return (
      <div style={{
        padding: '30px',
        textAlign: 'center',
        background: '#ffffff',
        borderRadius: '10px',
        border: '1px dashed #cbd5e1',
        color: '#64748b'
      }}>
        <p style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>No Plan Generated Yet</p>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
          Enter a question and click "Preview Plan" or "Execute" to decompose it.
        </p>
      </div>
    );
  }

  // Calculate layout: group nodes by level
  const { levels, nodePositions, svgWidth, svgHeight } = useMemo(() => {
    const levelMap = new Map();
    rawNodes.forEach(node => {
      const lvl = node.level || 0;
      if (!levelMap.has(lvl)) levelMap.set(lvl, []);
      levelMap.get(lvl).push(node);
    });

    const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);
    const nodePos = new Map();

    const columnWidth = 270;
    const cardWidth = 230;
    const cardHeight = 115;
    const verticalGap = 30;
    const leftMargin = 30;
    const topMargin = 45;

    let maxNodesInColumn = 1;

    sortedLevels.forEach((lvl, colIdx) => {
      const nodesInLvl = levelMap.get(lvl);
      maxNodesInColumn = Math.max(maxNodesInColumn, nodesInLvl.length);
      const colX = leftMargin + colIdx * columnWidth;

      nodesInLvl.forEach((node, rowIdx) => {
        const rowY = topMargin + rowIdx * (cardHeight + verticalGap);
        nodePos.set(node.id, {
          x: colX,
          y: rowY,
          width: cardWidth,
          height: cardHeight,
          centerX: colX + cardWidth / 2,
          centerY: rowY + cardHeight / 2,
          rightX: colX + cardWidth,
          leftX: colX
        });
      });
    });

    const width = Math.max(650, leftMargin * 2 + sortedLevels.length * columnWidth);
    const height = Math.max(240, topMargin * 2 + maxNodesInColumn * (cardHeight + verticalGap));

    return {
      levels: sortedLevels.map(lvl => ({ level: lvl, nodes: levelMap.get(lvl) })),
      nodePositions: nodePos,
      svgWidth: width,
      svgHeight: height
    };
  }, [rawNodes]);

  // Generate DAG edges
  const edges = useMemo(() => {
    const list = [];
    rawNodes.forEach(child => {
      const childPos = nodePositions.get(child.id);
      if (!childPos) return;

      (child.depends_on || []).forEach(parentRef => {
        const parentPos = nodePositions.get(parentRef);
        if (parentPos) {
          list.push({
            fromId: parentRef,
            toId: child.id,
            x1: parentPos.rightX,
            y1: parentPos.centerY,
            x2: childPos.leftX,
            y2: childPos.centerY
          });
        }
      });
    });
    return list;
  }, [rawNodes, nodePositions]);

  // Clean structured JSON schema
  const planJson = useMemo(() => {
    return {
      original_question: plan.original_question,
      hops: rawNodes.map(h => ({
        id: h.id,
        question: h.question,
        depends_on: h.depends_on || [],
        purpose: h.purpose || h.description || ""
      })),
      final_answer_instruction: plan.final_answer_instruction || `Use the answer from ${rawNodes[rawNodes.length - 1]?.id || 'H2'} as the final answer.`
    };
  }, [plan, rawNodes]);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(planJson, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 600 }}>
            Done
          </span>
        );
      case 'running':
        return (
          <span style={{ color: '#2563eb', fontSize: '11px', fontWeight: 600 }}>
            Running
          </span>
        );
      default:
        return (
          <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 500 }}>
            Queued
          </span>
        );
    }
  };

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '10px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
    }}>
      {/* Visualizer Top Bar */}
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#f8fafc'
      }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
            Dependency Graph ({rawNodes.length} hops)
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={() => setShowRawJson(!showRawJson)}
            style={{
              background: '#ffffff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11.5px',
              cursor: 'pointer'
            }}
          >
            {showRawJson ? 'View Graph' : 'View JSON'}
          </button>

          <div style={{ display: 'flex', gap: '10px', fontSize: '11.5px', color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#94a3b8' }}></span> Queued
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#2563eb' }}></span> Running
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }}></span> Completed
            </span>
          </div>
        </div>
      </div>

      {/* Final Answer Instruction Banner */}
      {planJson.final_answer_instruction && (
        <div style={{
          padding: '8px 18px',
          background: '#eff6ff',
          borderBottom: '1px solid #dbeafe',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px'
        }}>
          <strong style={{ color: '#1e40af' }}>Resolution:</strong>
          <span style={{ color: '#1e293b' }}>
            {planJson.final_answer_instruction}
          </span>
        </div>
      )}

      {/* Body: Raw JSON or Interactive Visual DAG */}
      {showRawJson ? (
        <div style={{ padding: '16px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '24px', right: '28px', zIndex: 10 }}>
            <button
              type="button"
              onClick={handleCopyJson}
              style={{
                background: copied ? '#ecfdf5' : '#ffffff',
                color: copied ? '#059669' : '#334155',
                border: '1px solid #cbd5e1',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
          </div>
          <pre style={{
            background: '#f8fafc',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            color: '#0f172a',
            fontSize: '12.5px',
            fontFamily: 'Consolas, Monaco, monospace',
            lineHeight: '1.5',
            overflowX: 'auto',
            maxHeight: '400px'
          }}>
            {JSON.stringify(planJson, null, 2)}
          </pre>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', padding: '16px', position: 'relative' }}>
          <svg width={svgWidth} height={svgHeight} style={{ display: 'block', margin: '0 auto' }}>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="9"
                markerHeight="7"
                refX="8"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 9 3.5, 0 7" fill="#2563eb" />
              </marker>
            </defs>

            {/* Render Level Columns background */}
            {levels.map((lvlGroup, idx) => (
              <text
                key={`lvl-${lvlGroup.level}`}
                x={30 + idx * 270 + 115}
                y={22}
                textAnchor="middle"
                fill="#64748b"
                fontSize="11px"
                fontWeight="600"
                letterSpacing="0.5px"
              >
                STAGE {lvlGroup.level + 1}
              </text>
            ))}

            {/* Render Bezier curve edges */}
            {edges.map((edge, idx) => {
              const dx = Math.abs(edge.x2 - edge.x1) * 0.5;
              const pathData = `M ${edge.x1} ${edge.y1} C ${edge.x1 + dx} ${edge.y1}, ${edge.x2 - dx} ${edge.y2}, ${edge.x2} ${edge.y2}`;
              return (
                <g key={`edge-${idx}`}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                </g>
              );
            })}

            {/* Render Node Cards as SVG foreignObject */}
            {rawNodes.map(node => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;
              const isSelected = selectedNodeId === node.id;
              const isCompleted = node.status === 'completed';
              const isRunning = node.status === 'running';

              let borderColor = '#cbd5e1';
              let bgColor = '#ffffff';
              if (isSelected) {
                borderColor = '#2563eb';
                bgColor = '#eff6ff';
              } else if (isCompleted) {
                borderColor = '#10b981';
              } else if (isRunning) {
                borderColor = '#2563eb';
                bgColor = '#f0f9ff';
              }

              return (
                <foreignObject
                  key={node.id}
                  x={pos.x}
                  y={pos.y}
                  width={pos.width}
                  height={pos.height}
                >
                  <div
                    onClick={() => onSelectNode && onSelectNode(node.id)}
                    style={{
                      width: '100%',
                      height: '100%',
                      background: bgColor,
                      border: `1.5px solid ${borderColor}`,
                      borderRadius: '8px',
                      padding: '9px 11px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
                      transition: 'all 0.15s ease',
                      userSelect: 'none'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{
                          background: '#f1f5f9',
                          color: '#2563eb',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700
                        }}>
                          {node.id}
                        </span>
                        {getStatusBadge(node.status)}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#0f172a',
                        fontWeight: 600,
                        lineHeight: '1.3',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        textOverflow: 'ellipsis'
                      }}>
                        {node.question}
                      </div>
                      {(node.purpose || node.description) && (
                        <div style={{
                          fontSize: '10.5px',
                          color: '#64748b',
                          marginTop: '2px',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis'
                        }}>
                          {node.purpose || node.description}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: '#64748b' }}>
                      <span>
                        {node.depends_on && node.depends_on.length > 0
                          ? `Depends on: ${node.depends_on.join(', ')}`
                          : 'Root'}
                      </span>
                      {node.retrieved_chunks && node.retrieved_chunks.length > 0 && (
                        <span style={{ color: '#059669', fontWeight: 600 }}>
                          {node.retrieved_chunks.length} chunks
                        </span>
                      )}
                    </div>
                  </div>
                </foreignObject>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
