# Sync API Documentation

This directory contains the API endpoints for synchronizing data between the web app and desktop app.

## Endpoints

### `/api/sync/patients`

Synchronizes patient data between the web app and desktop app.

**Method:** POST

**Request Body:**
```json
{
  "deviceId": "unique-device-id",
  "lastSyncTime": "2023-04-23T15:00:00.000Z",
  "patients": [
    {
      "id": "patient-id",
      "remote_id": "server-patient-id",
      "name": "Patient Name",
      "is_deleted": 0,
      "created_at": "2023-04-23T15:00:00.000Z",
      "updated_at": "2023-04-23T15:00:00.000Z"
    }
  ]
}
```

**Response:**
```json
{
  "patients": [
    {
      "id": "server-patient-id",
      "name": "Patient Name",
      "isDeleted": false,
      "createdAt": "2023-04-23T15:00:00.000Z",
      "updatedAt": "2023-04-23T15:00:00.000Z"
    }
  ],
  "conflicts": [
    {
      "local": {
        "id": "patient-id",
        "name": "Local Patient Name",
        "is_deleted": 0,
        "created_at": "2023-04-23T15:00:00.000Z",
        "updated_at": "2023-04-23T15:00:00.000Z"
      },
      "remote": {
        "id": "server-patient-id",
        "name": "Server Patient Name",
        "isDeleted": false,
        "createdAt": "2023-04-23T15:00:00.000Z",
        "updatedAt": "2023-04-23T15:00:00.000Z"
      }
    }
  ]
}
```

### `/api/sync/notes`

Synchronizes note data between the web app and desktop app.

**Method:** POST

**Request Body:**
```json
{
  "deviceId": "unique-device-id",
  "lastSyncTime": "2023-04-23T15:00:00.000Z",
  "notes": [
    {
      "id": "note-id",
      "remote_id": "server-note-id",
      "patient_id": "patient-id",
      "title": "Note Title",
      "content": "Note content",
      "transcript": "Note transcript",
      "summary": "Note summary",
      "visit_type": "initial",
      "visit_date": "2023-04-23T15:00:00.000Z",
      "is_deleted": 0,
      "created_at": "2023-04-23T15:00:00.000Z",
      "updated_at": "2023-04-23T15:00:00.000Z"
    }
  ]
}
```

**Response:**
```json
{
  "notes": [
    {
      "id": "server-note-id",
      "patientId": "patient-id",
      "title": "Note Title",
      "content": "Note content",
      "transcript": "Note transcript",
      "summary": "Note summary",
      "visitType": "initial",
      "visitDate": "2023-04-23T15:00:00.000Z",
      "isDeleted": false,
      "createdAt": "2023-04-23T15:00:00.000Z",
      "updatedAt": "2023-04-23T15:00:00.000Z"
    }
  ],
  "conflicts": []
}
```

### `/api/sync/audio-recordings/list`

Lists audio recordings that have been modified since the last sync.

**Method:** POST

**Request Body:**
```json
{
  "deviceId": "unique-device-id",
  "lastSyncTime": "2023-04-23T15:00:00.000Z"
}
```

**Response:**
```json
{
  "recordings": [
    {
      "id": "recording-id",
      "name": "Recording Name",
      "file_name": "recording.mp3",
      "size": 1024,
      "created_at": "2023-04-23T15:00:00.000Z",
      "note_id": "note-id"
    }
  ]
}
```

### `/api/sync/audio-recordings/upload`

Uploads an audio recording from the desktop app to the web app.

**Method:** POST

**Request Body:** FormData with the following fields:
- `deviceId`: Unique device ID
- `recordingId`: Recording ID
- `name`: Recording name
- `noteId`: Associated note ID (optional)
- `file`: Audio file

**Response:**
```json
{
  "id": "recording-id",
  "name": "Recording Name",
  "file_name": "recording.mp3",
  "size": 1024,
  "created_at": "2023-04-23T15:00:00.000Z",
  "note_id": "note-id"
}
```

### `/api/sync/audio-recordings/download/[id]`

Downloads an audio recording from the web app to the desktop app.

**Method:** GET

**Response:** Audio file with appropriate headers
