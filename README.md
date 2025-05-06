# BoredCertified

A web application for managing patient notes and transcripts.

## Tech Stack

- Next.js 14
- React
- Supabase (PostgreSQL database)
- OpenAI API
- TailwindCSS

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   OPENAI_API_KEY=your_openai_api_key
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## Database Setup

1. Create a new Supabase project
2. Run the setup script:
   ```bash
   npm run supabase:setup
   ```
3. (Optional) Import test data:
   ```bash
   npm run supabase:test-data
   ```

## Features

- Real-time audio transcription
- Patient note management
- SOAP note formatting
- Note summaries using GPT-4
- Dark mode support
- Automatic saving
- Data synchronization

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run linter
- `npm run supabase:setup` - Set up Supabase tables
- `npm run supabase:backup` - Backup data to Supabase
- `npm run supabase:test-data` - Import test data
- `npm run supabase:full-migration` - Run full migration

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
2. Update the database connection string in `.env.local`
3. Deploy using your preferred platform (Vercel, AWS, etc.)

## Supabase Integration

This application supports Supabase for data storage and authentication:

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Set up the required tables using the SQL script in `scripts/supabase-setup.sql`
3. Add your Supabase credentials to `.env.local`
4. To migrate data from SQLite to Supabase:
   ```bash
   npm run supabase:backup
   ```
5. To test your Supabase connection:
   ```bash
   npm run supabase:test
   ```

## Security Considerations

- All medical data is stored locally by default
- Implement proper authentication before deploying to production
- Ensure HIPAA compliance when deploying for medical use
- Use secure environment variables for API keys

## API

The web app provides a RESTful API for data access. The following endpoints are available:

- `/api/patients` - Manage patient data
- `/api/notes` - Manage note data
- `/api/audio-recordings` - Manage audio recordings

See the API documentation for more details.

## License

ISC License