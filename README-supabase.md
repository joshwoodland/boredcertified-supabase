# Supabase Backup and Sync Guide

This guide covers how to set up Supabase as a backup and synchronization solution for your application. It includes steps for setting up tables, migrating data, and maintaining synchronization between your local SQLite database and Supabase PostgreSQL database.

## Prerequisites

1. A Supabase account and project
2. Access to the Supabase SQL Editor
3. Your project's Supabase URL, API keys, and credentials added to your `.env.local` file

## Setup Steps

### 1. Create Tables in Supabase

First, you need to set up the database tables in Supabase that match your SQLite schema:

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy the content from `scripts/supabase-setup.sql`
4. Paste it into a new SQL query
5. Run the SQL script to create the tables

Alternatively, you can just run:
```bash
npm run supabase:setup
```
This will prompt you to run the SQL script manually in the Supabase SQL Editor.

### 2. Migrate Data to Supabase

Once the tables are set up, you can migrate your existing data from SQLite to Supabase:

```bash
npm run supabase:backup
```

This script will:
- Export data from your local SQLite database
- Create backup JSON files in the `temp` directory
- Upload the data to Supabase

### 3. Generate Test Data (if SQLite DB is unavailable)

If you don't have access to the original SQLite database or encounter issues with the migration, you can populate your Supabase database with test data:

```bash
npm run supabase:test-data
```

This script will:
- Create 3 sample patients
- Add 2 notes for each patient (1 initial visit and 1 follow-up)
- Set up default app settings
- Save the generated data to JSON files in the `temp` directory for reference

### 4. Complete Migration Process

To run the entire setup and migration process in one go:

```bash
npm run supabase:full-migration
```

This will prompt you to run the SQL setup script and then perform the data migration.

### 5. Assigning Provider Emails to Patients

To assign provider emails to existing patients, run the migration script:

```bash
node scripts/migrate-provider-emails.js provider@example.com
```

Or for TypeScript:

```bash
npx ts-node scripts/migrate-provider-emails.ts provider@example.com
```

This will assign the specified email address to all patients that don't currently have a provider assigned.

## Environment Variables

Ensure the following environment variables are set in your `.env.local` file:

```
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
DATABASE_URL=your-postgres-connection-string
DIRECT_URL=your-direct-postgres-connection-string
SQLITE_DATABASE_URL=file:./prisma/dev.db
```

## Implementation Details

### Database Schema

The migration maintains the following schema:

1. **Patients** - Stores patient information
   - id (UUID)
   - name (TEXT)
   - created_at, updated_at (TIMESTAMPS)
   - is_deleted (BOOLEAN)
   - deleted_at (TIMESTAMP, nullable)
   - provider_email (TEXT, nullable) - Email of the provider who owns this patient

2. **Notes** - Stores patient notes
   - id (UUID)
   - patient_id (UUID, foreign key to patients)
   - transcript, content (TEXT)
   - summary (TEXT, nullable)
   - audio_file_url (TEXT, nullable)
   - is_initial_visit (BOOLEAN)
   - created_at, updated_at (TIMESTAMPS)

3. **App Settings** - Stores application settings
   - id (TEXT)
   - dark_mode, auto_save, low_echo_cancellation (BOOLEAN)
   - gpt_model, initial_visit_prompt, follow_up_visit_prompt (TEXT)
   - updated_at (TIMESTAMP)

### Utility Functions

The application includes utility functions in `app/lib/supabase.ts` to:

- Check Supabase connection
- Fetch patients, notes and app settings from Supabase
- Convert between Prisma and Supabase data formats
- Filter patients by provider email to ensure users only see their own patients

### Row Level Security

Row Level Security (RLS) is enabled on the patients and notes tables to ensure providers can only access their own patient data:

- Patients are restricted to the authenticated user via the provider_email field
- Notes are restricted to the authenticated user via the patient's provider_email
- App settings are accessible to all authenticated users

## Troubleshooting

If you encounter issues during migration:

1. **Connection Problems**: Verify your Supabase credentials and connection strings
2. **Table Creation Issues**: Try creating tables manually through the Supabase interface
3. **Data Migration Errors**: Check the console output for specific error messages
4. **Format Conversion Issues**: Ensure date fields are properly formatted

For persistent issues, inspect the backup JSON files in the `temp` directory to verify the data integrity before uploading to Supabase.

## Security Considerations

The script uses the service role key, which has full database access. In production:

1. Row Level Security (RLS) is enabled by default for patients and notes tables
2. Store sensitive credentials in a secure manner
3. Implement proper user authentication for accessing data
