from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class DocumentInfo(BaseModel):
    id: str
    filename: str
    chunk_count: int
    char_count: int
    upload_time: str


class TextChunk(BaseModel):
    chunk_id: str
    doc_id: str
    doc_name: str
    chunk_index: int
    text: str
    start_char: int
    end_char: int


class ChunkSearchResult(BaseModel):
    chunk_id: str
    doc_id: str
    doc_name: str
    chunk_index: int
    text: str
    score: float


class SubQuestionNode(BaseModel):
    id: str
    question: str
    depends_on: List[str] = Field(default_factory=list)
    purpose: Optional[str] = None
    description: Optional[str] = None
    level: int = 0
    status: str = "pending"  # "pending", "running", "completed", "failed"
    contextualized_query: Optional[str] = None
    answer: Optional[str] = None
    retrieved_chunks: List[ChunkSearchResult] = Field(default_factory=list)


class QuestionPlanDAG(BaseModel):
    original_question: str
    hops: List[SubQuestionNode] = Field(default_factory=list)
    nodes: List[SubQuestionNode] = Field(default_factory=list)
    final_answer_instruction: Optional[str] = None
    execution_order: List[str] = Field(default_factory=list)
    is_valid_dag: bool = True
    error_message: Optional[str] = None


class HopExecutionResult(BaseModel):
    node_id: str
    question: str
    contextualized_query: str
    retrieved_chunks: List[ChunkSearchResult]
    answer: str
    reasoning: Optional[str] = None


class CitationItem(BaseModel):
    citation_id: int
    doc_name: str
    chunk_index: int
    chunk_id: str
    snippet: str
    score: float


class FinalAnswerResponse(BaseModel):
    original_question: str
    plan: QuestionPlanDAG
    intermediate_hops: List[HopExecutionResult]
    final_answer: str
    citations: List[CitationItem]
    total_retrieved_chunks: int
    timing_seconds: float


class LLMSettings(BaseModel):
    provider: str = "groq"  # "groq", "gemini", "openai", "custom"
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    base_url: Optional[str] = None
    temperature: float = 0.2
    top_k_retrieval: int = 3
    chunk_size: int = 500
    chunk_overlap: int = 100
