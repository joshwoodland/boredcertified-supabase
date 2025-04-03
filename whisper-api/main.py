import os
import tempfile
import shutil
import ssl
from pathlib import Path
from typing import Optional

# Add this line to bypass SSL certificate verification
ssl._create_default_https_context = ssl._create_unverified_context

import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Create tmp directory if it doesn't exist
temp_dir = Path("/tmp/whisper_api")
temp_dir.mkdir(exist_ok=True)

# Initialize FastAPI app
app = FastAPI(title="Whisper Transcription API")

# Add CORS middleware to allow requests from your frontend app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# For Vercel, we'll load the model on first request rather than at startup
_model = None

def get_model():
    global _model
    if _model is None:
        import whisper
        _model = whisper.load_model("base")
    return _model

class TranscribeResponse(BaseModel):
    transcript: str
    language: str
    duration: float

@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    file: Optional[UploadFile] = File(None),
    file_path: Optional[str] = Form(None)
):
    """
    Transcribe audio using Whisper.
    
    Either upload a file or provide a path to a local file.
    Supported formats: .mp3, .wav, .m4a, .webm
    """
    if not file and not file_path:
        raise HTTPException(status_code=400, detail="No audio file provided")
    
    temp_file = None
    try:
        # Handle uploaded file
        if file:
            # Create a temporary file with the correct extension
            suffix = Path(file.filename).suffix
            valid_formats = [".mp3", ".wav", ".m4a", ".webm"]
            
            if suffix.lower() not in valid_formats:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Unsupported file format. Supported formats: {', '.join(valid_formats)}"
                )
            
            # Save uploaded file to temp directory
            temp_file = temp_dir / f"{next(tempfile._get_candidate_names())}{suffix}"
            with open(temp_file, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            audio_path = str(temp_file)
            
        # Handle local file path
        else:
            if not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
            audio_path = file_path
        
        # Transcribe using Whisper
        model = get_model()
        result = model.transcribe(audio_path)
        
        return {
            "transcript": result["text"],
            "language": result["language"],
            "duration": result.get("duration", 0)
        }
    
    finally:
        # Clean up temp file
        if temp_file and os.path.exists(temp_file):
            os.remove(temp_file)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    model = get_model()
    return {"status": "ok", "model": model.model_name}

@app.get("/")
async def root():
    """Root endpoint for Vercel"""
    return {"message": "Whisper Transcription API is running. Post to /transcribe to transcribe audio."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 