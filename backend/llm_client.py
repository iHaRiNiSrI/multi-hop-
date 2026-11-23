import os
import json
import re
import logging
from typing import List, Dict, Any, Optional
import httpx
from models import LLMSettings, ChunkSearchResult, HopExecutionResult, QuestionPlanDAG

logger = logging.getLogger(__name__)


class LLMClient:
    """
    API-only LLM Client supporting Groq, Google Gemini, OpenAI, and Custom OpenAI-compatible APIs.
    Features dynamic model discovery for Groq, Gemini, and OpenAI to prevent 404 model-not-found errors.
    """

    def __init__(self, settings: Optional[LLMSettings] = None):
        self.settings = settings or LLMSettings()
        # Automatically detect environment variables
        if not self.settings.api_key:
            if os.getenv("GROQ_API_KEY"):
                self.settings.provider = "groq"
                self.settings.api_key = os.getenv("GROQ_API_KEY")
            elif os.getenv("GEMINI_API_KEY"):
                self.settings.provider = "gemini"
                self.settings.api_key = os.getenv("GEMINI_API_KEY")
            elif os.getenv("OPENAI_API_KEY"):
                self.settings.provider = "openai"
                self.settings.api_key = os.getenv("OPENAI_API_KEY")

    def update_settings(self, settings: LLMSettings):
        self.settings = settings

    async def _call_llm(self, prompt: str, system_prompt: str = "") -> str:
        provider = (self.settings.provider or "groq").lower()
        api_key = self.settings.api_key

        if not api_key and provider != "custom":
            raise ValueError(
                f"No API key configured for '{provider}'. "
                f"Please enter your {provider.capitalize()} API key in Settings or set the {provider.upper()}_API_KEY environment variable."
            )

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                if provider in ("groq", "openai", "custom"):
                    base_url = self.settings.base_url
                    if not base_url:
                        base_url = "https://api.groq.com/openai/v1" if provider == "groq" else "https://api.openai.com/v1"

                    user_model = (self.settings.model_name or "").strip()
                    # Default Groq to llama-3.1-8b-instant which is universally active
                    if not user_model or (provider == "groq" and user_model == "llama-3.3-70b-versatile"):
                        model = "llama-3.1-8b-instant" if provider == "groq" else "gpt-4o-mini"
                    else:
                        model = user_model

                    headers = {
                        "Authorization": f"Bearer {api_key or ''}",
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system_prompt or "You are an expert multi-hop reasoning assistant."},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": self.settings.temperature
                    }
                    resp = await client.post(f"{base_url.rstrip('/')}/chat/completions", headers=headers, json=payload)

                    # If model not found (404), auto-query /models to discover accessible models for this key
                    if resp.status_code == 404:
                        logger.warning(f"{provider.capitalize()} model '{model}' returned 404. Calling /models to auto-discover active models...")
                        try:
                            models_resp = await client.get(f"{base_url.rstrip('/')}/models", headers=headers)
                            if models_resp.status_code == 200:
                                models_data = models_resp.json().get("data", [])
                                chat_models = [
                                    m["id"] for m in models_data
                                    if "whisper" not in m.get("id", "").lower()
                                    and "guard" not in m.get("id", "").lower()
                                    and "embedding" not in m.get("id", "").lower()
                                ]
                                # Sort: prioritize llama-3.1-8b-instant, then llama-3.1, then other llama
                                chat_models.sort(key=lambda x: (
                                    0 if "3.1-8b-instant" in x else
                                    1 if "3.1" in x else
                                    2 if "llama" in x else
                                    3
                                ))
                                logger.info(f"Available chat models for {provider}: {chat_models}")
                                for fallback_m in chat_models:
                                    payload["model"] = fallback_m
                                    resp = await client.post(f"{base_url.rstrip('/')}/chat/completions", headers=headers, json=payload)
                                    if resp.status_code == 200:
                                        logger.info(f"Auto-selected working {provider} model: {fallback_m}")
                                        self.settings.model_name = fallback_m
                                        break
                        except Exception as auto_err:
                            logger.warning(f"Auto-discovery failed: {auto_err}")

                    resp.raise_for_status()
                    data = resp.json()
                    return data["choices"][0]["message"]["content"].strip()

                elif provider == "gemini":
                    user_model = (self.settings.model_name or "").strip().replace("models/", "")
                    if not user_model or user_model in ("gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.0"):
                        model = "gemini-2.5-flash"
                    else:
                        model = user_model

                    payload = {
                        "contents": [{"parts": [{"text": f"{system_prompt}\n\n{prompt}"}]}],
                        "generationConfig": {"temperature": self.settings.temperature}
                    }

                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                    resp = await client.post(url, json=payload)

                    # If model not found (404), dynamically query ModelService.ListModels to find available models
                    if resp.status_code == 404:
                        logger.warning(f"Gemini model '{model}' returned 404. Calling ModelService.ListModels to auto-detect active models...")
                        try:
                            list_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
                            list_resp = await client.get(list_url)
                            if list_resp.status_code == 200:
                                available_models = list_resp.json().get("models", [])
                                valid_models = [
                                    m["name"].replace("models/", "")
                                    for m in available_models
                                    if "generateContent" in m.get("supportedGenerationMethods", [])
                                ]
                                # Sort: prioritize flash, then pro
                                valid_models.sort(key=lambda name: (0 if "flash" in name else (1 if "pro" in name else 2)))
                                logger.info(f"Available models for this key: {valid_models}")

                                for fallback_m in valid_models:
                                    fallback_url = f"https://generativelanguage.googleapis.com/v1beta/models/{fallback_m}:generateContent?key={api_key}"
                                    resp = await client.post(fallback_url, json=payload)
                                    if resp.status_code == 200:
                                        logger.info(f"Auto-selected working Gemini model: {fallback_m}")
                                        self.settings.model_name = fallback_m
                                        break
                        except Exception as auto_err:
                            logger.warning(f"Auto-discovery failed: {auto_err}")

                    resp.raise_for_status()
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts:
                            return parts[0].get("text", "").strip()
                    raise ValueError("Gemini returned empty candidate response.")
                else:
                    raise ValueError(f"Unsupported provider: {provider}")

            except httpx.HTTPStatusError as e:
                err_text = e.response.text
                try:
                    err_json = e.response.json()
                    if "error" in err_json:
                        if isinstance(err_json["error"], dict) and "message" in err_json["error"]:
                            err_text = err_json["error"]["message"]
                        elif isinstance(err_json["error"], str):
                            err_text = err_json["error"]
                except Exception:
                    pass
                logger.error(f"HTTP error from {provider} API ({e.response.status_code}): {err_text}")
                raise ValueError(f"{provider.capitalize()} API error: {err_text}")
            except Exception as e:
                logger.error(f"Error calling {provider} API: {e}")
                raise ValueError(f"Failed to communicate with {provider} API: {str(e)}")

    async def plan_subquestions(self, original_question: str, doc_context_preview: str = "") -> Dict[str, Any]:
        """
        Decomposes complex question into a structured DAG of atomic subquestions.
        Calls LLM API directly.
        """
        system_prompt = (
            "You are an expert Question Planning Agent for a Multi-Hop RAG pipeline.\n"
            "Your task is to decompose a complex user query into an optimal Directed Acyclic Graph (DAG) "
            "of dependent atomic subquestions.\n\n"
            "RULES:\n"
            "1. Identify the transitive dependency chain. Break the question into atomic hops (H1, H2, H3, etc.).\n"
            "2. Each hop must ask for exactly ONE entity, organization, person, date, or attribute.\n"
            "3. If a hop requires an entity discovered in an earlier hop, explicitly reference it (e.g. 'the company identified in H1') and list that hop in 'depends_on'.\n"
            "4. Return ONLY valid JSON with keys: 'original_question', 'hops', and 'final_answer_instruction'.\n"
            "5. Each item in 'hops' must have: 'id' (H1, H2, etc.), 'question', 'depends_on' (list of hop IDs), and 'purpose'."
        )

        user_prompt = (
            f"User Question: {original_question}\n\n"
            "Return JSON matching this exact structure:\n"
            "{\n"
            f'  "original_question": "{original_question}",\n'
            '  "hops": [\n'
            '    {\n'
            '      "id": "H1",\n'
            '      "question": "...",\n'
            '      "depends_on": [],\n'
            '      "purpose": "..."\n'
            '    }\n'
            '  ],\n'
            '  "final_answer_instruction": "Use the answer from H... as the final answer."\n'
            "}"
        )

        raw = await self._call_llm(user_prompt, system_prompt)

        # Strip markdown fences if present
        clean_raw = raw.strip()
        if "```" in clean_raw:
            clean_raw = re.sub(r"^```(?:json)?\s*", "", clean_raw, flags=re.IGNORECASE)
            clean_raw = re.sub(r"\s*```$", "", clean_raw)

        # Parse JSON from response
        try:
            # 1. Direct parse
            try:
                parsed = json.loads(clean_raw)
                if isinstance(parsed, dict) and "hops" in parsed and len(parsed["hops"]) > 0:
                    return parsed
            except Exception:
                pass

            # 2. Match object with "hops"
            json_obj_match = re.search(r'\{.*"hops"\s*:\s*\[.*?\].*?\}', clean_raw, re.DOTALL)
            if json_obj_match:
                return json.loads(json_obj_match.group(0))

            # 3. Match array of hops
            json_arr_match = re.search(r'\[\s*\{.*\}\s*\]', clean_raw, re.DOTALL)
            if json_arr_match:
                nodes = json.loads(json_arr_match.group(0))
                last_id = nodes[-1].get("id", f"H{len(nodes)}")
                return {
                    "original_question": original_question,
                    "hops": nodes,
                    "final_answer_instruction": f"Use the answer from {last_id} as the final answer."
                }
        except Exception as e:
            logger.warning(f"Failed to parse LLM planning JSON: {e}")

        raise ValueError(f"LLM API did not return valid DAG decomposition JSON. Raw response: {raw[:300]}")

    async def contextualize_query(self, subquestion: str, parent_context: str) -> str:
        """
        Rewrites a subquestion by substituting resolved entities from prerequisite hops.
        Calls LLM API directly.
        """
        if not parent_context.strip():
            return subquestion

        system_prompt = (
            "You are a Query Contextualization Assistant for a vector retrieval system.\n"
            "Rewrite the subquestion into a concrete, standalone vector search query by replacing "
            "pronouns and references (such as 'the company identified in H1', 'this entity', 'the CEO') "
            "with the specific entity names resolved in the previous hops.\n"
            "Output ONLY the rewritten standalone query string. Do not include quotes, explanations, or labels."
        )

        user_prompt = (
            f"Previous Hops Context:\n{parent_context}\n\n"
            f"Subquestion to rewrite: {subquestion}\n\n"
            "Standalone Query:"
        )

        try:
            rewritten = await self._call_llm(user_prompt, system_prompt)
            clean = rewritten.strip().strip('"').strip("'")
            return clean if clean else subquestion
        except Exception as e:
            logger.warning(f"Contextualization API call failed ({e}), using original subquestion.")
            return subquestion

    async def answer_hop(
        self,
        subquestion: str,
        retrieved_chunks: List[ChunkSearchResult],
        parent_evidence_text: str = "",
        contextualized_query: str = ""
    ) -> str:
        """
        Answers a single atomic hop based strictly on the retrieved document chunks.
        Calls LLM API directly.
        """
        chunks_text = "\n\n".join([
            f"[Source: {c.doc_name} (Chunk #{c.chunk_index})]:\n{c.text.strip()}"
            for c in retrieved_chunks
        ])

        system_prompt = (
            "You are an expert factual reasoning assistant in a multi-hop RAG pipeline.\n"
            "Your task is to answer the given atomic subquestion strictly using the provided document passages.\n"
            "RULES:\n"
            "1. Answer concisely and factually, stating the specific entity, date, organization, or attribute requested.\n"
            "2. Do NOT hallucinate or assume facts not stated in the passages.\n"
            "3. If the passages do not contain the answer, state: 'The provided document passages do not contain information to answer this question.'"
        )

        user_prompt = (
            f"Subquestion: {subquestion}\n\n"
            f"Prerequisite Context from Prior Hops:\n{parent_evidence_text or 'None'}\n\n"
            f"Retrieved Document Passages:\n{chunks_text or 'No passages retrieved.'}\n\n"
            "Concise Answer:"
        )

        return await self._call_llm(user_prompt, system_prompt)

    async def generate_final_answer(
        self,
        original_question: str,
        evidence_prompt_context: str,
        plan: QuestionPlanDAG,
        intermediate_hops: List[HopExecutionResult]
    ) -> str:
        """
        Synthesizes the complete final answer grounded in all intermediate hops and citations.
        Calls LLM API directly.
        """
        system_prompt = (
            "You are a rigorous, truthful Question-Answering reasoning agent.\n"
            "Your task is to synthesize the final answer to the user's multi-hop question.\n\n"
            "GROUNDING RULES:\n"
            "1. Rely ONLY on the provided intermediate hop findings and document passages. Never use external training knowledge.\n"
            "2. If the evidence is insufficient to answer the question, clearly state what information is missing.\n"
            "3. Format your response into two distinct sections:\n"
            "   **Answer**: Direct, clear, and unambiguous response to the user's question.\n"
            "   **Evidence Chain**: Numbered breakdown of the multi-hop reasoning steps and the documents supporting each step."
        )

        user_prompt = (
            f"User Question: {original_question}\n\n"
            f"Multi-Hop Execution Evidence:\n{evidence_prompt_context}\n\n"
            "Final Grounded Response:"
        )

        return await self._call_llm(user_prompt, system_prompt)
