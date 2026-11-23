# Multi-Hop RAG System with DAG Question Planning

A clean, end-to-end Multi-Hop Retrieval-Augmented Generation (RAG) system with dynamic query decomposition, Directed Acyclic Graph (DAG) validation, local embeddings via Sentence Transformers, vector similarity search using FAISS, sequential hop context propagation, and API-based grounded answer generation with citations.

---

## 📁 Project Structure

```
├── backend/                  # Complete backend in one folder
│   ├── main.py               # FastAPI application entry point
│   ├── models.py             # Pydantic data schemas
│   ├── llm_client.py         # Pure API-based LLM Client (Groq, Gemini, OpenAI, Custom)
│   ├── vector_store.py       # FAISS index + local Sentence Transformers (all-MiniLM-L6-v2)
│   ├── document_processor.py # Text chunking with sliding overlap
│   ├── dag_engine.py         # Topological sorting (Kahn's algorithm) & cycle detection
│   ├── question_planner.py   # Decomposes complex queries into atomic DAG hops
│   ├── hop_executor.py       # Sequential hop execution with context propagation
│   ├── evidence_manager.py   # Aggregates hop evidence & builds source citations
│   ├── answer_generator.py   # Synthesizes final grounded answer
│   ├── run_backend.py        # CLI helper to launch uvicorn
│   ├── requirements.txt      # Backend Python dependencies
│   ├── .env.example          # Environment variables template
│   └── data/                 # Local FAISS index & metadata store
│
├── frontend/                 # Complete frontend in one folder
│   ├── src/                  # React source code (App.jsx, components, CSS)
│   ├── package.json          # Node dependencies
│   └── vite.config.js        # Vite config with API proxy to port 8000
│
├── start.bat                 # One-click launcher for Windows (Command Prompt)
├── start.ps1                 # One-click launcher for Windows (PowerShell)
└── README.md                 # System overview and quick start guide
```

---

## 🚀 Quick Start

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Start backend server (runs on http://127.0.0.1:8000)
python main.py
```

### 2. Frontend Setup
```bash
cd frontend
npm install

# Start frontend dev server (runs on http://localhost:5173)
npm run dev
```

### 3. One-Click Launcher (Windows)
Double-click `start.bat` or run:
```powershell
.\start.ps1
```

---

## 🔑 LLM API Configuration

The system uses **APIs only** (no mock/heuristic local fallbacks). Supported providers:
- **Groq** (Default: `llama-3.3-70b-versatile` - fast, free tier available)
- **Google Gemini** (`gemini-2.0-flash`)
- **OpenAI** (`gpt-4o-mini`, `gpt-4o`)
- **Custom OpenAI-compatible** (Ollama, LocalAI, vLLM)

You can set your API key in either:
1. The **Settings** button in the web UI.
2. An environment variable or `.env` file inside `backend/`:
   ```bash
   GROQ_API_KEY=your_groq_api_key
   # or
   GEMINI_API_KEY=your_gemini_api_key
   # or
   OPENAI_API_KEY=your_openai_api_key
   ```
