import React from 'react';

export default function EvidenceView({ citations, totalRetrieved, timingSeconds }) {
  if (!citations || citations.length === 0) {
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
            Source Citations ({citations.length})
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '8px', fontSize: '11.5px' }}>
          {timingSeconds > 0 && (
            <span style={{
              background: '#f1f5f9',
              color: '#475569',
              padding: '3px 8px',
              borderRadius: '6px'
            }}>
              ⏱ {timingSeconds}s
            </span>
          )}
        </div>
      </div>

      <div style={{
        padding: '16px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '12px'
      }}>
        {citations.map((cit) => (
          <div
            key={cit.citation_id}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '4px'
                }}>
                  [{cit.citation_id}]
                </span>
                <span style={{
                  fontSize: '11px',
                  color: '#059669',
                  fontWeight: 600
                }}>
                  {(cit.score * 100).toFixed(1)}% match
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                {cit.doc_name}
              </div>
              <p style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic', lineHeight: '1.45' }}>
                "{cit.snippet}"
              </p>
            </div>
            <div style={{ marginTop: '10px', fontSize: '11px', color: '#64748b' }}>
              Chunk index: #{cit.chunk_index}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
