# Medical Scribe Assistant

A web application for medical professionals to record patient conversations and automatically generate SOAP notes using AI. The application uses OpenAI's Whisper for speech-to-text transcription and GPT-4 for generating structured SOAP notes.

## Features

- 🎙️ Audio recording of patient conversations
- 📝 Automatic transcription using OpenAI Whisper
- 🤖 AI-powered SOAP note generation
- 👥 Patient management system
- 📁 Organized storage of patient records
- 🔄 Historical context integration

## Tech Stack

- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- Prisma (SQLite database)
- OpenAI API (Whisper & GPT-4)
- React Audio Voice Recorder

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with:
   ```
   OPENAI_API_KEY=your_openai_api_key
   ```

4. Initialize the database:
   ```bash
   npx prisma db push
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Add a new patient using the + button in the patient list
2. Select a patient from the list
3. Click the record button to start recording the conversation
4. Stop the recording when finished
5. The system will automatically:
   - Transcribe the audio
   - Generate a SOAP note
   - Save everything to the patient's record

## Deployment

The application can be deployed to any platform that supports Next.js applications. For production deployment:

1. Set up a production database
2. Update the database connection string in `.env`
3. Deploy using your preferred platform (Vercel, AWS, etc.)

## Security Considerations

- All medical data is stored locally by default
- Implement proper authentication before deploying to production
- Ensure HIPAA compliance when deploying for medical use
- Use secure environment variables for API keys

## License

MIT License 