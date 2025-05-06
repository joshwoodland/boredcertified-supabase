# Supabase Integration Guide

This guide explains how to set up and use Supabase in the application.

## Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and API keys from the project settings
3. Set up environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```
4. Run the database setup script:
   ```bash
   npm run supabase:setup
   ```

## Database Schema

The application uses the following tables:

- `patients` - Patient information
- `notes` - Patient notes and transcripts
- `app_settings` - Application settings

## Data Migration

To migrate data to Supabase:

1. Run the backup script:
   ```bash
   npm run supabase:backup
   ```

2. (Optional) Import test data:
   ```bash
   npm run supabase:test-data
   ```

## Data Types

The application uses two main data formats:

1. Supabase Format (snake_case):
   - Used in database tables
   - Example: `created_at`, `is_deleted`

2. Application Format (camelCase):
   - Used in the application code
   - Example: `createdAt`, `isDeleted`

The application automatically converts between these formats using utility functions.

## Authentication

The application uses Supabase Auth with email/password authentication. Row Level Security (RLS) policies ensure data access control.

## File Storage

Audio files are stored in Supabase Storage buckets. The application handles upload/download through the Supabase client.
