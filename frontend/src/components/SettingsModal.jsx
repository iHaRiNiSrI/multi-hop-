import React, { useState, useEffect } from 'react';

export default function SettingsModal({ isOpen, onClose, settings, onSave }) {
  const [formData, setFormData] = useState({
    provider: 'groq',
    api_key: '',
    model_name: '',
    base_url: '',
    temperature: 0.2,
    top_k_retrieval: 3,
    chunk_size: 500,
    chunk_overlap: 100
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        provider: settings.provider === 'built-in' ? 'groq' : (settings.provider || 'groq'),
        api_key: settings.api_key || '',
        model_name: settings.model_name || '',
        base_url: settings.base_url || '',
        temperature: settings.temperature ?? 0.2,
        top_k_retrieval: settings.top_k_retrieval ?? 3,
        chunk_size: settings.chunk_size ?? 500,
        chunk_overlap: settings.chunk_overlap ?? 100
      });
    }
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 500);
  };

  const getModelPlaceholder = () => {
    switch (formData.provider) {
      case 'gemini': return 'gemini-2.5-flash';
      case 'groq': return 'llama-3.1-8b-instant';
      case 'openai': return 'gpt-4o-mini';
      default: return 'llama-3.1-8b-instant';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '520px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc'
        }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
              Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '20px',
              lineHeight: 1,
              padding: '2px 6px'
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px' }}>
          {/* Provider Selection */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
              LLM API Provider
            </label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              style={{ width: '100%' }}
            >
              <option value="groq">Groq API (Llama 3.1 8B Instant / Auto-detect)</option>
              <option value="gemini">Google Gemini API (Gemini 2.5 Flash / Auto-detect)</option>
              <option value="openai">OpenAI API (GPT-4o-mini)</option>
              <option value="custom">Custom OpenAI-Compatible (Ollama / LocalAI / vLLM)</option>
            </select>
          </div>

          {/* API Key */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
              API Key
            </label>
            <input
              type="password"
              placeholder={`Enter your ${formData.provider} API key...`}
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              style={{ width: '100%' }}
            />
            <p style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
              Can also be set via {formData.provider.toUpperCase()}_API_KEY in your environment or .env file.
            </p>
          </div>

          {/* Model Name */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
              Model Name (optional)
            </label>
            <input
              type="text"
              placeholder={getModelPlaceholder()}
              value={formData.model_name}
              onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>

          {/* Base URL for custom */}
          {formData.provider === 'custom' && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                Base URL
              </label>
              <input
                type="text"
                placeholder="http://localhost:11434/v1"
                value={formData.base_url}
                onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {/* Retrieval Settings */}
          <div style={{
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid #e2e8f0'
          }}>
            <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Retrieval Configuration
            </h4>

            {/* Top-K retrieval */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#334155', marginBottom: '3px' }}>
                <span>Top-K Chunks per Hop:</span>
                <span style={{ fontWeight: 600, color: '#2563eb' }}>{formData.top_k_retrieval}</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={formData.top_k_retrieval}
                onChange={(e) => setFormData({ ...formData, top_k_retrieval: parseInt(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            {/* Chunk Size */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#334155', marginBottom: '3px' }}>
                <span>Chunk Size (chars):</span>
                <span style={{ fontWeight: 600, color: '#2563eb' }}>{formData.chunk_size}</span>
              </div>
              <input
                type="range"
                min="200"
                max="1200"
                step="50"
                value={formData.chunk_size}
                onChange={(e) => setFormData({ ...formData, chunk_size: parseInt(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            {/* Chunk Overlap */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#334155', marginBottom: '3px' }}>
                <span>Chunk Overlap (chars):</span>
                <span style={{ fontWeight: 600, color: '#2563eb' }}>{formData.chunk_overlap}</span>
              </div>
              <input
                type="range"
                min="0"
                max="300"
                step="25"
                value={formData.chunk_overlap}
                onChange={(e) => setFormData({ ...formData, chunk_overlap: parseInt(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                padding: '7px 14px',
                borderRadius: '6px',
                fontSize: '12.5px'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '7px 16px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600
              }}
            >
              {savedSuccess ? 'Saved!' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
