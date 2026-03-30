import asyncio
import json
import re
import time
from typing import Any
import google.generativeai as genai
from app.config import settings
from app.models.task import TaskType

genai.configure(api_key=settings.GEMINI_API_KEY)
_model = genai.GenerativeModel("gemini-2.5-flash")


def _extract_json(text: str) -> dict | list:
    """Try to extract JSON from a string, even if surrounded by extra text."""
    # First try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try to find JSON object or array using regex
    match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Could not extract valid JSON from model response: {text[:200]}")


async def _call_gemini_with_retry(prompt: str, max_retries: int = 3) -> str:
    """Call Gemini with exponential backoff on failure."""
    last_exc = None
    for attempt in range(max_retries):
        try:
            response = await asyncio.to_thread(_model.generate_content, prompt)
            return response.text
        except Exception as exc:
            last_exc = exc
            wait = 2 ** attempt
            await asyncio.sleep(wait)
    raise RuntimeError(f"Gemini API failed after {max_retries} retries: {last_exc}")


async def execute(task_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Dispatch to the correct task handler and return structured result."""
    handlers = {
        TaskType.TEXT_SUMMARIZE: _summarize,
        TaskType.SENTIMENT_ANALYSIS: _sentiment,
        TaskType.CODE_REVIEW: _code_review,
        TaskType.DATA_EXTRACTION: _data_extraction,
        TaskType.CUSTOM: _custom,
    }
    handler = handlers.get(task_type)
    if not handler:
        raise ValueError(f"Unknown task type: {task_type}")
    return await handler(payload)


async def _summarize(payload: dict[str, Any]) -> dict[str, Any]:
    text = payload.get("text", "")
    max_length = payload.get("max_length", 150)
    prompt = (
        f"Summarize the following text in {max_length} words or fewer. "
        "Be concise and preserve key information. Return only the summary, no preamble.\n\n"
        f"{text}"
    )
    summary = await _call_gemini_with_retry(prompt)
    summary = summary.strip()
    return {
        "summary": summary,
        "original_length": len(text.split()),
        "summary_length": len(summary.split()),
    }


async def _sentiment(payload: dict[str, Any]) -> dict[str, Any]:
    text = payload.get("text", "")
    prompt = (
        "Analyze the sentiment of this text. Return a JSON object with: "
        "sentiment (POSITIVE/NEGATIVE/NEUTRAL), confidence (0.0-1.0), "
        "key_phrases (array of strings driving sentiment), "
        "brief_explanation (one sentence). Return ONLY valid JSON.\n\n"
        f"{text}"
    )
    raw = await _call_gemini_with_retry(prompt)
    return _extract_json(raw)


async def _code_review(payload: dict[str, Any]) -> dict[str, Any]:
    code = payload.get("code", "")
    language = payload.get("language", "Python")
    prompt = (
        f"Review this {language} code. Return a JSON object with: "
        "issues (array of {line, severity: INFO/WARNING/ERROR, message}), "
        "suggestions (array of strings), score (0-10), summary (string). "
        "Return ONLY valid JSON.\n\n"
        f"{code}"
    )
    raw = await _call_gemini_with_retry(prompt)
    return _extract_json(raw)


async def _data_extraction(payload: dict[str, Any]) -> dict[str, Any]:
    text = payload.get("text", "")
    fields = payload.get("fields", [])
    fields_str = ", ".join(fields)
    prompt = (
        f"Extract the following fields from the text: {fields_str}. "
        "Return a JSON object where each key is a field name and value is the extracted data "
        "or null if not found. Return ONLY valid JSON.\n\n"
        f"{text}"
    )
    raw = await _call_gemini_with_retry(prompt)
    return _extract_json(raw)


async def _custom(payload: dict[str, Any]) -> dict[str, Any]:
    prompt = payload.get("prompt", "")
    response = await _call_gemini_with_retry(prompt)
    return {"response": response.strip()}
