# Provider Name Dynamic SOAP Notes Implementation

## Overview
This implementation adds a "Provider Name" setting that dynamically replaces the hardcoded "Josh Woodland, APRN, PMHNP" text at the end of generated SOAP notes with the provider's actual name from the settings.

## Changes Made

### 1. Database Schema Updates
- **File**: `scripts/add-provider-name-migration.sql`
- Added `provider_name` column to `app_settings` table
- Set default value to "Josh Woodland, APRN, PMHNP" for backward compatibility
- Added proper indexing for performance

### 2. Type Definitions
- **File**: `app/lib/supabaseTypes.ts`
- Added `provider_name` field to `SupabaseSettings` interface
- Added `providerName` field to `AppSettings` interface
- Updated conversion functions to handle the new field

### 3. Default Settings
- **File**: `app/lib/defaultSettings.ts`
- Added `providerName: 'Josh Woodland, APRN, PMHNP'` to default settings

### 4. Settings Converter
- **File**: `app/utils/settingsConverter.ts`
- Updated `supabaseToAppSettings()` and `appToSupabaseSettings()` functions
- Added proper handling for `providerName` field conversion

### 5. Settings UI
- **File**: `app/components/Settings.tsx`
- Added "Provider Information" section with provider name input field
- Updated form data interface to include `providerName`
- Added auto-save functionality for the new field

### 6. SOAP Templates
- **File**: `app/utils/soapTemplates.ts`
- Converted static templates to functions that accept `providerName` parameter
- Created `getInitialEvaluationTemplate(providerName)` and `getFollowUpVisitTemplate(providerName)`
- Maintained backward compatibility with legacy exports

### 7. OpenAI Message Builder
- **File**: `app/utils/buildOpenAIMessages.ts`
- Updated to accept `providerName` parameter
- Uses dynamic templates based on provider name
- Enhanced logging to include provider name information

### 8. API Route Updates
- **File**: `app/api/notes/route.ts`
- Added logic to fetch provider name from user settings
- Falls back to default provider name if settings unavailable
- Passes provider name to `buildOpenAIMessages()` function

### 9. Provider Settings Integration
- **File**: `app/providers/AppSettingsProvider.tsx`
- Updated new user settings creation to include provider name
- Ensures default provider name is set for new users

## How to Use

### 1. Run Database Migration
```bash
# Apply the migration to your Supabase database
# Run this SQL script in your Supabase SQL editor:
scripts/add-provider-name-migration.sql
```

### 2. Update Provider Name
1. Open the application
2. Navigate to Settings (gear icon)
3. In the "Provider Information" section, update the "Provider Name" field
4. Example: "Carolyn Conover, APRN, PMHNP"
5. Changes are auto-saved

### 3. Generate SOAP Notes
- New SOAP notes will automatically use your provider name
- The ending signature will now read: "Note reviewed, edited, and finalized by [Your Provider Name]"
- Both Initial Evaluation and Follow-up Visit notes will use the dynamic name

## Testing

### 1. Verify Settings
- Check that the provider name field appears in Settings
- Verify auto-save functionality works
- Confirm the field updates in the database

### 2. Test SOAP Note Generation
1. Create a new patient note with a transcript
2. Generate a SOAP note
3. Verify the provider name appears correctly at the end:
   - Initial notes: "**Reviewed, edited and accepted by [Provider Name]**"
   - Follow-up notes: "**Note reviewed, edited, and finalized by [Provider Name].**"

### 3. Test Different Scenarios
- Test with logged-in users (uses user-specific settings)
- Test with logged-out users (uses default settings)
- Test with multiple providers (each should see their own name)

## Backward Compatibility
- Existing installations will continue to work with "Josh Woodland, APRN, PMHNP" as default
- Legacy template exports are maintained for any custom integrations
- No breaking changes to existing API contracts

## Technical Notes
- Provider name is fetched fresh for each SOAP note generation
- Fallback mechanisms ensure the system works even if settings are unavailable
- The feature supports both authenticated and unauthenticated users
- All existing SOAP note formatting and structure is preserved 