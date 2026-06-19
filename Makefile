.PHONY: install serve test lint typecheck pipeline \
        generate-data preprocess features train clean

# ── Dev ──────────────────────────────────────────────────────────────────────
install:
	pip install -e ".[dev]" --quiet

serve:
	uvicorn yieldguard.serving.api:app --reload --port 8000

# ── Pipeline steps ───────────────────────────────────────────────────────────
generate-data:
	python -m yieldguard.data.synthesizer

preprocess:
	python -m yieldguard.data.preprocessor

features:
	python -m yieldguard.features.engineer

train:
	python -m yieldguard.models.trainer

pipeline: generate-data preprocess features train
	@echo "Pipeline complete."

# ── Quality ──────────────────────────────────────────────────────────────────
test:
	pytest tests/ -v

test-fast:
	pytest tests/ -x -q

lint:
	ruff check src/

typecheck:
	mypy src/yieldguard --ignore-missing-imports

# ── Misc ─────────────────────────────────────────────────────────────────────
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; true
	find . -name "*.pyc" -delete 2>/dev/null; true
