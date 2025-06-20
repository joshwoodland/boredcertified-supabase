# Master Settings System

This document explains the new Master Settings system that allows you to configure backend processes without rebuilding the application.

## Overview

The Master Settings system moves critical backend configurations from hardcoded files to a database table called `master_settings`. This allows you to:

- Edit SOAP note templates without rebuilding the app
- Change AI models for different purposes without code deployment
- Centrally manage backend configuration
- Make changes that take effect immediately

## Database Schema

The `master_settings` table contains the following columns:

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Primary key (always 'default') |
| `initial_eval_soap_template` | TEXT | SOAP note template for initial psychiatric evaluations |
| `follow_up_visit_soap_template` | TEXT | SOAP note template for follow-up visits |
| `generate_soap_model` | TEXT | AI model used for generating SOAP notes |
| `checklist_model` | TEXT | AI model used for checklist operations |
| `note_summary_model` | TEXT | AI model used for note summary generation |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

## Migration

To set up the master settings system:

1. **Run the migration script:**
   ```sql
   -- Execute this in your Supabase SQL Editor
   \i scripts/create-master-settings-table.sql
   ```

2. **Verify the table was created:**
   ```sql
   SELECT * FROM master_settings WHERE id = 'default';
   ```

## API Endpoints

### GET /api/master-settings
Fetches the current master settings.

**Response:**
```json
{
  "id": "default",
  "initial_eval_soap_template": "...",
  "follow_up_visit_soap_template": "...",
  "generate_soap_model": "gpt-4o",
  "checklist_model": "gpt-4o",
  "note_summary_model": "gpt-4o",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### PUT /api/master-settings
Updates one or more master settings.

**Request Body:**
```json
{
  "initial_eval_soap_template": "Updated template...",
  "generate_soap_model": "gpt-4o-mini"
}
```

**Response:**
```json
{
  "message": "Master settings updated successfully",
  "settings": { /* updated settings object */ }
}
```

### DELETE /api/master-settings
Resets all master settings to their default values.

**Response:**
```json
{
  "message": "Master settings reset to defaults successfully",
  "settings": { /* reset settings object */ }
}
```

## Available AI Models

The system supports the following AI models:

- `gpt-4o` - Latest optimized GPT-4 model (recommended)
- `gpt-4o-mini` - Lightweight version with faster response times
- `gpt-4` - Standard GPT-4 model
- `gpt-3.5-turbo` - Faster, less expensive option

## Usage Examples

### Updating SOAP Templates

To update the initial evaluation template:

```bash
curl -X PUT http://localhost:3000/api/master-settings \
  -H "Content-Type: application/json" \
  -d '{
    "initial_eval_soap_template": "Your new template here..."
  }'
```

### Changing AI Models

To change the model used for SOAP note generation:

```bash
curl -X PUT http://localhost:3000/api/master-settings \
  -H "Content-Type: application/json" \
  -d '{
    "generate_soap_model": "gpt-4o-mini"
  }'
```

### Fetching Current Settings

```bash
curl http://localhost:3000/api/master-settings
```

## Code Integration

### Using Master Settings in Code

```typescript
import { getMasterSettings, getSoapTemplate, getModelForPurpose } from '@/app/utils/masterSettings';

// Get SOAP template for initial evaluation
const template = await getSoapTemplate(true);

// Get AI model for a specific purpose
const model = await getModelForPurpose('generate_soap');

// Get all master settings
const settings = await getMasterSettings();
```

### Caching

The system includes intelligent caching:
- Settings are cached for 30 seconds to reduce database calls
- Cache is automatically cleared when settings are updated
- Fallback to cached values if database is temporarily unavailable

## Migration from Old System

### Before (Hardcoded)
```typescript
// Old way - hardcoded in files
import { INITIAL_EVALUATION_TEMPLATE } from './soapTemplates';
const template = INITIAL_EVALUATION_TEMPLATE;
```

### After (Database-driven)
```typescript
// New way - from database
import { getSoapTemplate } from './masterSettings';
const template = await getSoapTemplate(true);
```

## Error Handling

The system includes robust error handling:

1. **Database unavailable**: Falls back to cached values or defaults
2. **Network errors**: Graceful degradation with default templates
3. **Invalid data**: Validation with helpful error messages

## Security

- Row Level Security (RLS) is enabled on the `master_settings` table
- Only authenticated users can read/write master settings
- All changes are logged with timestamps

## Troubleshooting

### Settings not updating
1. Check if the database migration was run successfully
2. Verify the API endpoints are accessible
3. Clear the cache manually if needed

### Template not applying
1. Ensure the template is valid text
2. Check for any parsing errors in the logs
3. Verify the correct visit type is being used

### Model not found
1. Confirm the model name is correct
2. Check if the model is available in your OpenAI account
3. Verify API key permissions

## Best Practices

1. **Backup templates** before making changes
2. **Test templates** with sample data first
3. **Use descriptive models** appropriate for each purpose
4. **Monitor performance** when changing models
5. **Keep templates** reasonably sized to avoid token limits

## Future Enhancements

Planned improvements include:
- Web UI for editing master settings
- Template versioning and rollback
- A/B testing for different templates
- Performance analytics per model
- Template validation and syntax checking