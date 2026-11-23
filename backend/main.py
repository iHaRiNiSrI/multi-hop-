import os
import time
import logging
from typing import List, Optional
from dotenv import load_dotenv

# Load .env file from backend directory or parent
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import (
    DocumentInfo,
    QuestionPlanDAG,
    FinalAnswerResponse,
    LLMSettings
)
from document_processor import DocumentProcessor
from vector_store import VectorStore
from llm_client import LLMClient
from question_planner import QuestionPlanner
from hop_executor import HopExecutor
from evidence_manager import EvidenceManager
from answer_generator import AnswerGenerator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rag-app")

app = FastAPI(title="Multi-Hop RAG API")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize core services
doc_processor = DocumentProcessor()
vector_store = VectorStore()
vector_store.load_state()

llm_settings = LLMSettings()
llm_client = LLMClient(llm_settings)
question_planner = QuestionPlanner(llm_client)
answer_generator = AnswerGenerator(llm_client)

uploaded_documents: List[DocumentInfo] = []


class QueryRequest(BaseModel):
    question: str
    top_k: Optional[int] = 3


class PlanRequest(BaseModel):
    question: str


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "vector_store": vector_store.get_stats(),
        "llm_provider": llm_client.settings.provider,
        "has_api_key": bool(llm_client.settings.api_key)
    }


@app.get("/api/documents")
def get_documents():
    return {
        "documents": uploaded_documents,
        "stats": vector_store.get_stats()
    }


@app.delete("/api/documents")
def clear_documents():
    global uploaded_documents
    vector_store.clear()
    uploaded_documents = []
    return {"message": "All documents and vector embeddings cleared successfully."}


@app.delete("/api/documents/{doc_id}")
def delete_single_document(doc_id: str):
    global uploaded_documents
    target = next((d for d in uploaded_documents if d.id == doc_id), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Document with ID {doc_id} not found.")

    uploaded_documents = [d for d in uploaded_documents if d.id != doc_id]
    removed_chunks = vector_store.remove_document(doc_id)
    return {
        "message": f"Document '{target.filename}' removed ({removed_chunks} chunks deleted).",
        "documents": uploaded_documents,
        "stats": vector_store.get_stats()
    }


@app.post("/api/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    global uploaded_documents
    results = []

    for file in files:
        try:
            content_bytes = await file.read()
            try:
                content = content_bytes.decode("utf-8")
            except UnicodeDecodeError:
                content = content_bytes.decode("latin-1", errors="replace")

            if not content.strip():
                continue

            doc_info, chunks = doc_processor.process_document(
                content=content,
                filename=file.filename,
                chunk_size=llm_settings.chunk_size,
                chunk_overlap=llm_settings.chunk_overlap
            )

            vector_store.add_chunks([c.model_dump() for c in chunks])
            uploaded_documents.append(doc_info)
            results.append(doc_info)
        except Exception as e:
            logger.error(f"Error processing file {file.filename}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to process {file.filename}: {str(e)}")

    return {
        "message": f"Successfully indexed {len(results)} document(s)",
        "documents": results,
        "total_chunks_in_store": len(vector_store.get_all_chunks())
    }


@app.post("/api/plan-only", response_model=QuestionPlanDAG)
async def preview_dag_plan(req: PlanRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        all_chunks = vector_store.get_all_chunks()
        doc_preview = " ".join([c["text"][:100] for c in all_chunks[:5]])
        plan = await question_planner.create_plan(req.question, doc_preview)
        return plan
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error generating plan: {e}")
        raise HTTPException(status_code=500, detail=f"Plan generation failed: {str(e)}")


@app.post("/api/query", response_model=FinalAnswerResponse)
async def execute_multi_hop_query(req: QueryRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    all_chunks = vector_store.get_all_chunks()
    if not all_chunks:
        raise HTTPException(status_code=400, detail="No documents have been indexed yet. Please upload documents first.")

    start_time = time.time()

    try:
        # Step 1: Question Planning & DAG validation
        doc_preview = " ".join([c["text"][:100] for c in all_chunks[:5]])
        plan = await question_planner.create_plan(req.question, doc_preview)

        # Step 2: Evidence Manager & Hop Executor
        evidence_mgr = EvidenceManager()
        hop_executor = HopExecutor(
            vector_store=vector_store,
            llm_client=llm_client,
            evidence_manager=evidence_mgr
        )

        # Step 3: Sequential Hop Execution
        top_k = req.top_k or llm_settings.top_k_retrieval
        intermediate_hops = await hop_executor.execute_plan(plan, top_k=top_k)

        # Step 4: Final Grounded Answer Generation
        elapsed = time.time() - start_time
        response = await answer_generator.generate_response(
            original_question=req.question,
            plan=plan,
            intermediate_hops=intermediate_hops,
            evidence_mgr=evidence_mgr,
            elapsed_seconds=elapsed
        )

        return response
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error executing multi-hop query: {e}")
        raise HTTPException(status_code=500, detail=f"Multi-hop execution failed: {str(e)}")


@app.get("/api/settings")
def get_settings():
    return llm_client.settings


@app.post("/api/settings")
def update_settings(settings: LLMSettings):
    global llm_settings
    llm_settings = settings
    llm_client.update_settings(settings)
    return {"message": "Settings updated successfully", "settings": llm_client.settings}


# Serve production frontend build if available
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

dist_dirs = [
    os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"),
    os.path.join(os.path.dirname(__file__), "static"),
    os.path.join(os.path.dirname(__file__), "dist")
]
frontend_dist = next((d for d in dist_dirs if os.path.exists(d)), None)

if frontend_dist:
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"Starting Multi-Hop RAG Backend Server on http://127.0.0.1:{port} ...")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

