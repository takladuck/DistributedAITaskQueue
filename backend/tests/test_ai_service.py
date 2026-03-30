import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from app.models.task import TaskType


def make_mock_response(text: str):
    response = MagicMock()
    response.text = text
    return response


@pytest.mark.asyncio
async def test_text_summarize_output_structure():
    mock_text = "This is a long article about artificial intelligence and its impact on society."
    payload = {"text": mock_text, "max_length": 20}
    summary = "AI impacts society significantly."

    with patch("app.services.ai_service._model") as mock_model:
        mock_model.generate_content = MagicMock(return_value=make_mock_response(summary))
        from app.services.ai_service import execute
        result = await execute(TaskType.TEXT_SUMMARIZE, payload)
        assert "summary" in result
        assert "original_length" in result
        assert "summary_length" in result
        assert result["original_length"] == len(mock_text.split())


@pytest.mark.asyncio
async def test_sentiment_analysis_output_structure():
    sentiment_json = json.dumps({
        "sentiment": "POSITIVE",
        "confidence": 0.92,
        "key_phrases": ["great", "excellent"],
        "brief_explanation": "The text is overwhelmingly positive.",
    })
    payload = {"text": "This is a great and excellent product!"}

    with patch("app.services.ai_service._model") as mock_model:
        mock_model.generate_content = MagicMock(return_value=make_mock_response(sentiment_json))
        from app.services.ai_service import execute
        result = await execute(TaskType.SENTIMENT_ANALYSIS, payload)
        assert result["sentiment"] == "POSITIVE"
        assert "confidence" in result
        assert isinstance(result["key_phrases"], list)


@pytest.mark.asyncio
async def test_code_review_output_structure():
    review_json = json.dumps({
        "issues": [{"line": 5, "severity": "WARNING", "message": "Unused variable"}],
        "suggestions": ["Add type hints"],
        "score": 7,
        "summary": "Generally good code with minor issues.",
    })
    payload = {"code": "x = 1\nprint('hello')", "language": "Python"}

    with patch("app.services.ai_service._model") as mock_model:
        mock_model.generate_content = MagicMock(return_value=make_mock_response(review_json))
        from app.services.ai_service import execute
        result = await execute(TaskType.CODE_REVIEW, payload)
        assert "issues" in result
        assert "score" in result
        assert isinstance(result["issues"], list)
        assert result["score"] == 7


@pytest.mark.asyncio
async def test_data_extraction_output_structure():
    extracted_json = json.dumps({
        "name": "John Doe",
        "email": "john@example.com",
        "phone": None,
    })
    payload = {"text": "My name is John Doe, email john@example.com", "fields": ["name", "email", "phone"]}

    with patch("app.services.ai_service._model") as mock_model:
        mock_model.generate_content = MagicMock(return_value=make_mock_response(extracted_json))
        from app.services.ai_service import execute
        result = await execute(TaskType.DATA_EXTRACTION, payload)
        assert result["name"] == "John Doe"
        assert result["phone"] is None


@pytest.mark.asyncio
async def test_custom_task_output():
    payload = {"prompt": "Write a haiku about Python."}

    with patch("app.services.ai_service._model") as mock_model:
        mock_model.generate_content = MagicMock(return_value=make_mock_response("Snakes slither fast\nCode flows like a quiet stream\nBugs are found at last"))
        from app.services.ai_service import execute
        result = await execute(TaskType.CUSTOM, payload)
        assert "response" in result
        assert len(result["response"]) > 0


@pytest.mark.asyncio
async def test_json_fallback_on_malformed_model_output():
    """Ensure regex extraction works when model wraps JSON in prose."""
    wrapped = 'Here is the result: {"sentiment": "NEUTRAL", "confidence": 0.5, "key_phrases": [], "brief_explanation": "Neutral text."} That is all.'
    payload = {"text": "The weather is okay."}

    with patch("app.services.ai_service._model") as mock_model:
        mock_model.generate_content = MagicMock(return_value=make_mock_response(wrapped))
        from app.services.ai_service import execute
        result = await execute(TaskType.SENTIMENT_ANALYSIS, payload)
        assert result["sentiment"] == "NEUTRAL"


@pytest.mark.asyncio
async def test_retry_logic_on_api_failure():
    """Gemini fails twice then succeeds on the third attempt."""
    call_count = 0

    def side_effect(prompt):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise RuntimeError("Temporary API error")
        return make_mock_response("Python is fast\nElegant and clean code flows\nBugs hide in plain sight")

    payload = {"prompt": "Write a haiku."}

    with patch("app.services.ai_service._model") as mock_model:
        mock_model.generate_content = side_effect
        with patch("asyncio.sleep", new_callable=AsyncMock):  # skip actual waits
            from app.services.ai_service import execute
            result = await execute(TaskType.CUSTOM, payload)
            assert call_count == 3
            assert "response" in result
