# Whisper Transcription API

A FastAPI-based API for transcribing audio using OpenAI's Whisper model.

## Features

- Transcribe audio files (.mp3, .wav, .m4a, .webm)
- Uses OpenAI's Whisper model for high-quality transcription
- Fast and reliable
- Easy deployment to Vercel

## Deployment to Vercel

1. Install the Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy from the whisper-api directory:
   ```bash
   cd whisper-api
   vercel
   ```

4. Follow the prompts in the CLI:
   - Set up and deploy "whisper-api"? Yes
   - Which scope do you want to deploy to? [Your account]
   - Link to existing project? No
   - What's your project name? whisper-api
   - In which directory is your code located? ./
   - Want to override the settings? No

5. After deployment, update your front-end code with the Vercel URL:
   ```typescript
   // In AudioRecorder.tsx
   fetch('https://your-vercel-url.vercel.app/transcribe', {
     method: 'POST',
     body: formData
   })
   ```

## API Endpoints

### POST /transcribe

Upload an audio file to transcribe it.

**Parameters**:
- `file`: The audio file to transcribe (form-data)

**Response**:
```json
{
  "transcript": "Transcribed text here",
  "language": "en",
  "duration": 10.5
}
```

### GET /health

Check if the API is running and which model is loaded.

**Response**:
```json
{
  "status": "ok",
  "model": "base"
}
```

## Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn main:app --reload --port 8000
```

## Important Notes for Vercel Deployment

- Whisper model will be loaded on first request, which may cause a cold start delay
- Vercel has a function execution time limit (10-60s depending on your plan)
- For production with longer audio files, consider a non-serverless host like Render.com or a custom VM 