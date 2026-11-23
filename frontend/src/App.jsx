import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud } from 'lucide-react';

import DAGVisualizer from './components/DAGVisualizer';
import HopTimeline from './components/HopTimeline';
import EvidenceView from './components/EvidenceView';
import SettingsModal from './components/SettingsModal';

const API_BASE = '/api';

export default function App() {
  // State
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({ total_chunks: 0, unique_documents: 0 });
  const [question, setQuestion] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [plan, setPlan] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [error, setError] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('dag'); // 'dag' or 'timeline' or 'evidence'
  const [copiedAnswer, setCopiedAnswer] = useState(false);

  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);

  // Load initial health, stats, and settings
  const fetchStatus = async () => {
    try {
      const docRes = await fetch(`${API_BASE}/documents`);
      if (docRes.ok) {
        const data = await docRes.json();
        setDocuments(data.documents || []);
        setStats(data.stats || { total_chunks: 0, unique_documents: 0 });
      }

      const setRes = await fetch(`${API_BASE}/settings`);
      if (setRes.ok) {
        const data = await setRes.json();
        setSettings(data);
      }
    } catch (err) {
      console.warn('API not reachable yet:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Handle file upload
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Upload failed');
      }
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Clear all documents
  const handleClearDocs = async () => {
    if (!window.confirm('Are you sure you want to clear all indexed documents?')) {
      return;
    }
    try {
      await fetch(`${API_BASE}/documents`, { method: 'DELETE' });
      setPlan(null);
      setExecutionResult(null);
      await fetchStatus();
    } catch (err) {
      setError('Failed to clear documents.');
    }
  };

  // Delete individual document
  const handleDeleteSingleDoc = async (docId, filename) => {
    if (!window.confirm(`Remove "${filename}" from index?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to delete document');
      }
      await fetchStatus();
    } catch (err) {
      setError(err.message || 'Failed to remove document.');
    }
  };

  // Plan only (Preview DAG)
  const handlePlanDAG = async () => {
    if (!question.trim()) {
      setError('Please enter a question to decompose.');
      return;
    }
    setIsPlanning(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/plan-only`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Planning failed');
      }
      const data = await res.json();
      setPlan(data);
      setExecutionResult(null);
      setActiveTab('dag');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsPlanning(false);
    }
  };

  // Execute full Multi-Hop pipeline
  const handleExecuteMultiHop = async () => {
    if (!question.trim()) {
      setError('Please enter a question.');
      return;
    }
    if (stats.total_chunks === 0) {
      setError('Please upload at least one document first.');
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Execution failed');
      }
      const data = await res.json();
      setPlan(data.plan);
      setExecutionResult(data);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsExecuting(false);
    }
  };

  // Update Settings
  const handleSaveSettings = async (newSettings) => {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      {/* Top Navbar */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
      }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px', margin: 0 }}>
            Multi-Hop RAG Visualizer Dashboard
          </h1>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Index Counter Badge */}
          <div style={{
            background: '#f1f5f9',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            fontSize: '12px',
            color: '#475569'
          }}>
            <span>Indexed: </span>
            <strong style={{ color: '#0f172a' }}>{stats.total_chunks} chunks</strong>
          </div>

          {/* Clear DB */}
          {stats.total_chunks > 0 && (
            <button
              onClick={handleClearDocs}
              style={{
                background: '#ffffff',
                color: '#ef4444',
                border: '1px solid #fecaca',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12.5px'
              }}
              title="Clear all indexed documents"
            >
              Clear
            </button>
          )}

          {/* Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              background: '#ffffff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 500
            }}
          >
            Settings
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ flex: 1, display: 'flex', maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px 20px', gap: '24px' }}>
        {/* Left Column: Documents */}
        <div style={{ width: '310px', flexShrink: 0 }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '18px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '12px' }}>
              Documents
            </h3>

            {/* Dropzone - KEEP UploadCloud icon right here before "Upload documents" */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '1.5px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '20px 14px',
                textAlign: 'center',
                cursor: 'pointer',
                background: '#f8fafc',
                transition: 'all 0.15s ease',
                marginBottom: '14px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#2563eb';
                e.currentTarget.style.background = '#f0f7ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.background = '#f8fafc';
              }}
            >
              <UploadCloud size={24} style={{ margin: '0 auto 6px', color: '#2563eb' }} />
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>
                {isUploading ? 'Indexing files...' : 'Upload documents'}
              </p>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                .txt, .md, .csv, .json
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.markdown,.json,.csv,.log,.py,.js"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>

            {/* Uploaded Documents List */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b', marginBottom: '8px' }}>
                <span>Indexed ({documents.length})</span>
                <span>{stats.total_chunks} chunks</span>
              </div>

              {documents.length === 0 ? (
                <div style={{
                  padding: '16px 12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#64748b'
                }}>
                  No documents uploaded yet. Upload files above to begin.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '420px', overflowY: 'auto' }}>
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ overflow: 'hidden', marginRight: '6px' }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {doc.filename}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {doc.chunk_count} chunks
                        </div>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSingleDoc(doc.id, doc.filename)}
                          title={`Remove ${doc.filename}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '12px',
                            padding: '2px 4px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Area: Query & Results */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Query Box */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
          }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>
              Question
            </label>

            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <textarea
                rows={3}
                placeholder="Enter your question..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                style={{
                  width: '100%',
                  fontSize: '13.5px',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '10px 12px'
                }}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '14px'
              }}>
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handlePlanDAG}
                disabled={isPlanning || isExecuting}
                style={{
                  background: '#ffffff',
                  color: '#1e293b',
                  border: '1px solid #cbd5e1',
                  padding: '9px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                {isPlanning ? 'Planning...' : 'Preview Plan'}
              </button>

              <button
                type="button"
                onClick={handleExecuteMultiHop}
                disabled={isPlanning || isExecuting}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 20px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)'
                }}
              >
                {isExecuting ? 'Executing...' : 'Execute'}
              </button>
            </div>
          </div>

          {/* Results Section */}
          {(plan || executionResult) && (
            <div>
              {/* Tab Selector */}
              <div style={{
                display: 'flex',
                gap: '4px',
                borderBottom: '1px solid #e2e8f0',
                marginBottom: '18px'
              }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('dag')}
                  style={{
                    background: activeTab === 'dag' ? '#ffffff' : 'transparent',
                    color: activeTab === 'dag' ? '#2563eb' : '#64748b',
                    border: '1px solid',
                    borderColor: activeTab === 'dag' ? '#e2e8f0 #e2e8f0 #ffffff #e2e8f0' : 'transparent',
                    borderBottom: activeTab === 'dag' ? '2px solid #2563eb' : '2px solid transparent',
                    borderRadius: '6px 6px 0 0',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  Plan
                </button>

                {executionResult && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveTab('timeline')}
                      style={{
                        background: activeTab === 'timeline' ? '#ffffff' : 'transparent',
                        color: activeTab === 'timeline' ? '#2563eb' : '#64748b',
                        border: '1px solid',
                        borderColor: activeTab === 'timeline' ? '#e2e8f0 #e2e8f0 #ffffff #e2e8f0' : 'transparent',
                        borderBottom: activeTab === 'timeline' ? '2px solid #2563eb' : '2px solid transparent',
                        borderRadius: '6px 6px 0 0',
                        padding: '8px 14px',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    >
                      Execution ({executionResult.intermediate_hops?.length || 0})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('evidence')}
                      style={{
                        background: activeTab === 'evidence' ? '#ffffff' : 'transparent',
                        color: activeTab === 'evidence' ? '#2563eb' : '#64748b',
                        border: '1px solid',
                        borderColor: activeTab === 'evidence' ? '#e2e8f0 #e2e8f0 #ffffff #e2e8f0' : 'transparent',
                        borderBottom: activeTab === 'evidence' ? '2px solid #2563eb' : '2px solid transparent',
                        borderRadius: '6px 6px 0 0',
                        padding: '8px 14px',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    >
                      Citations ({executionResult.citations?.length || 0})
                    </button>
                  </>
                )}
              </div>

              {/* Final Grounded Answer Banner (if executed) */}
              {executionResult && (
                <div
                  ref={resultsRef}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderLeft: '4px solid #2563eb',
                    borderRadius: '10px',
                    padding: '18px 20px',
                    marginBottom: '20px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        Answer
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(executionResult.final_answer);
                          setCopiedAnswer(true);
                          setTimeout(() => setCopiedAnswer(false), 2000);
                        }}
                        style={{
                          background: copiedAnswer ? '#ecfdf5' : '#f8fafc',
                          color: copiedAnswer ? '#059669' : '#475569',
                          border: '1px solid #e2e8f0',
                          padding: '4px 9px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {copiedAnswer ? 'Copied' : 'Copy'}
                      </button>
                      <span style={{
                        background: '#f1f5f9',
                        color: '#64748b',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontWeight: 500
                      }}>
                        {executionResult.timing_seconds}s
                      </span>
                    </div>
                  </div>

                  <div style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: '#1e293b',
                    whiteSpace: 'pre-wrap',
                    padding: '14px 16px',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0'
                  }}>
                    {executionResult.final_answer}
                  </div>
                </div>
              )}

              {/* Tab 1: DAG View */}
              {activeTab === 'dag' && (
                <DAGVisualizer
                  plan={plan}
                  onSelectNode={(nodeId) => {
                    setSelectedNodeId(nodeId);
                    setActiveTab('timeline');
                  }}
                  selectedNodeId={selectedNodeId}
                />
              )}

              {/* Tab 2: Hop Timeline */}
              {activeTab === 'timeline' && executionResult && (
                <HopTimeline
                  hops={executionResult.intermediate_hops}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              )}

              {/* Tab 3: Evidence View */}
              {activeTab === 'evidence' && executionResult && (
                <EvidenceView
                  citations={executionResult.citations}
                  totalRetrieved={executionResult.total_retrieved_chunks}
                  timingSeconds={executionResult.timing_seconds}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
