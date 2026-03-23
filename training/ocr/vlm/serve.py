"""
FastAPI Inference Server — Local REST API for the VLM Engine
=============================================================
Endpoints:
  POST /ocr          — Process a single image (multipart upload)
  POST /ocr/batch    — Process multiple images
  POST /correct      — Submit a human correction (self-expanding)
  GET  /health       — Health check
  GET  /stats        — Processing statistics
  GET  /audit        — Recent audit log entries

This server runs air-gapped inside Docker. No outbound connections.
"""

import json
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse

from inference_engine import MedGradeInferenceEngine
from audit_logger import AuditLogger

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB per file
MAX_BATCH_SIZE = 20  # Maximum files per batch request

app = FastAPI(
    title="MedGrade OCR API",
    description="Air-gapped medical document OCR with self-expanding intelligence",
    version="1.0.0",
)

# Initialize engine (lazy — loads model on first request)
_engine = None

def get_engine():
    global _engine
    if _engine is None:
        _engine = MedGradeInferenceEngine(
            backend=os.environ.get("OCR_BACKEND", "paddle"),
            output_dir="/app/results",
            use_gpu=os.environ.get("PADDLE_OCR_USE_GPU", "1") == "1",
        )
    return _engine


@app.get("/health")
async def health():
    return {"status": "ok", "service": "medgrade-ocr", "gpu": os.environ.get("CUDA_VISIBLE_DEVICES", "none")}


@app.post("/ocr")
async def process_image(
    file: UploadFile = File(...),
    user: str = Form(default="api_user"),
):
    """Process a single medical document image."""
    if not file.filename:
        raise HTTPException(400, "No file provided")

    suffix = Path(file.filename).suffix
    if suffix.lower() not in {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"}:
        raise HTTPException(400, f"Unsupported format: {suffix}")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(413, f"File too large ({len(content)} bytes, max {MAX_FILE_SIZE})")
        tmp.write(content)
        tmp_path = tmp.name

    try:
        engine = get_engine()
        result = engine.process_document(tmp_path, user=user)
        return JSONResponse(content=result)
    finally:
        os.unlink(tmp_path)


@app.post("/ocr/batch")
async def process_batch(
    files: list[UploadFile] = File(...),
    user: str = Form(default="api_user"),
):
    """Process multiple medical document images."""
    if len(files) > MAX_BATCH_SIZE:
        raise HTTPException(400, f"Too many files ({len(files)}, max {MAX_BATCH_SIZE})")
    results = []
    engine = get_engine()

    for file in files:
        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            result = engine.process_document(tmp_path, user=user)
            results.append(result)
        except Exception as e:
            results.append({"file": file.filename, "error": str(e)})
        finally:
            os.unlink(tmp_path)

    return JSONResponse(content={"results": results, "total": len(results)})


@app.post("/correct")
async def submit_correction(
    image_name: str = Form(...),
    original_text: str = Form(...),
    corrected_text: str = Form(...),
    reviewer: str = Form(default="doctor"),
):
    """Submit a human correction for self-expanding learning."""
    engine = get_engine()
    engine.submit_correction(image_name, original_text, corrected_text, reviewer=reviewer)
    return {"status": "ok", "message": "Training pair saved"}


@app.get("/stats")
async def stats():
    """Get processing statistics."""
    engine = get_engine()
    results_dir = engine.output_dir
    review_dir = engine.review_dir
    training_dir = engine.training_dir

    processed = len(list(results_dir.glob("*.json")))
    flagged = 0
    for f in review_dir.glob("*.jsonl"):
        flagged += sum(1 for line in f.read_text(encoding="utf-8").splitlines() if line.strip())
    pairs = 0
    pairs_file = training_dir / "corrections.jsonl"
    if pairs_file.exists():
        pairs = sum(1 for line in pairs_file.read_text(encoding="utf-8").splitlines() if line.strip())

    return {
        "documents_processed": processed,
        "entries_flagged": flagged,
        "training_pairs": pairs,
        "audit_entries": engine.audit.count(),
    }


@app.get("/audit")
async def audit_log(limit: int = 50):
    """Get recent audit log entries."""
    engine = get_engine()
    entries = engine.audit.query_recent(limit=limit)
    return {
        "entries": [
            {
                "id": e[0], "timestamp": e[1], "user": e[2],
                "action": e[3], "file_path": e[4], "file_hash": e[5],
            }
            for e in entries
        ]
    }
