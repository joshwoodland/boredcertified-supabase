export interface SupabasePatient {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  is_deleted: boolean;
  deleted_at: string | null;
  provider_email: string | null;
}

export interface SupabaseNote {
  id: string;
  created_at: string;
  updated_at: string;
  patient_id: string;
  transcript: string;
  content: string;
  summary: string | null;
  audio_file_url: string | null;
  is_initial_visit: boolean;
  checklist_content: any | null; // JSON field for storing follow-up checklist items
  source_note_id: string | null; // Reference to the note this checklist was generated from
}

export interface SupabaseSettings {
  id: string;
  dark_mode: boolean;
  gpt_model: string;
  initial_visit_additional_preferences: string;
  follow_up_visit_additional_preferences: string;
  auto_save: boolean;
  provider_name: string;
  supervisor: string | null;
  email: string | null;
  user_id: string | null;
  updated_at: string;
}

export interface AppPatient {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  providerEmail: string | null;
}

export interface AppNote {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  patientId: string;
  transcript: string;
  content: string;
  summary: string | null;
  isInitialVisit: boolean;
  checklistContent: any | null; // JSON field for storing follow-up checklist items
  sourceNoteId: string | null; // Reference to the note this checklist was generated from
}

/**
 * Application settings interface - the canonical definition for the entire app
 */
export interface AppSettings {
  id: string;
  darkMode: boolean;
  gptModel: string;
  initialVisitPrompt: string;
  followUpVisitPrompt: string;
  autoSave: boolean;
  providerName: string;
  supervisor: string | null;
  email: string | null;
  userId: string | null;
  updatedAt: Date;
  // Optional properties used in some parts of the app
  temperature?: number;
  maxTokens?: number;
}

export type SupabaseRecord = SupabasePatient | SupabaseNote | SupabaseSettings;
export type AppRecord = AppPatient | AppNote | AppSettings;

/**
 * Converts Supabase record format to application format
 * @param record The Supabase record to convert
 * @param type The type of record being converted
 * @returns Converted record in application format
 */
export function convertToAppFormat(record: SupabaseRecord, type: 'patient' | 'note' | 'settings') {
  if (!record) return null;

  if (type === 'patient') {
    const patientRecord = record as SupabasePatient;
    return {
      id: patientRecord.id,
      createdAt: new Date(patientRecord.created_at),
      updatedAt: new Date(patientRecord.updated_at),
      name: patientRecord.name,
      isDeleted: patientRecord.is_deleted,
      deletedAt: patientRecord.deleted_at ? new Date(patientRecord.deleted_at) : null,
      providerEmail: patientRecord.provider_email,
    } as AppPatient;
  }

  if (type === 'note') {
    const noteRecord = record as SupabaseNote;
    return {
      id: noteRecord.id,
      createdAt: new Date(noteRecord.created_at),
      updatedAt: new Date(noteRecord.updated_at),
      patientId: noteRecord.patient_id,
      transcript: noteRecord.transcript,
      content: noteRecord.content,
      summary: noteRecord.summary,
      isInitialVisit: noteRecord.is_initial_visit,
      checklistContent: noteRecord.checklist_content,
      sourceNoteId: noteRecord.source_note_id,
    } as AppNote;
  }

  if (type === 'settings') {
    const settingsRecord = record as SupabaseSettings;
    return {
      id: settingsRecord.id,
      darkMode: settingsRecord.dark_mode,
      gptModel: settingsRecord.gpt_model,
      initialVisitPrompt: settingsRecord.initial_visit_additional_preferences,
      followUpVisitPrompt: settingsRecord.follow_up_visit_additional_preferences,
      autoSave: settingsRecord.auto_save,
      providerName: settingsRecord.provider_name,
      email: settingsRecord.email,
      userId: settingsRecord.user_id,
      updatedAt: new Date(settingsRecord.updated_at),
    } as AppSettings;
  }

  return null;
}

/**
 * Converts application format to Supabase record format
 * @param record The application record to convert
 * @param type The type of record being converted
 * @returns Converted record in Supabase format
 */
export function convertToSupabaseFormat(record: AppRecord, type: 'patient' | 'note' | 'settings') {
  if (!record) return null;

  if (type === 'patient') {
    const patientRecord = record as AppPatient;
    return {
      id: patientRecord.id,
      created_at: patientRecord.createdAt.toISOString(),
      updated_at: patientRecord.updatedAt.toISOString(),
      name: patientRecord.name,
      is_deleted: patientRecord.isDeleted,
      deleted_at: patientRecord.deletedAt?.toISOString() || null,
      provider_email: patientRecord.providerEmail,
    } as SupabasePatient;
  }

  if (type === 'note') {
    const noteRecord = record as AppNote;
    return {
      id: noteRecord.id,
      created_at: noteRecord.createdAt.toISOString(),
      updated_at: noteRecord.updatedAt.toISOString(),
      patient_id: noteRecord.patientId,
      transcript: noteRecord.transcript,
      content: noteRecord.content,
      summary: noteRecord.summary,
      is_initial_visit: noteRecord.isInitialVisit,
      checklist_content: noteRecord.checklistContent,
      source_note_id: noteRecord.sourceNoteId,
    } as SupabaseNote;
  }

  if (type === 'settings') {
    const settingsRecord = record as AppSettings;
    return {
      id: settingsRecord.id,
      dark_mode: settingsRecord.darkMode,
      gpt_model: settingsRecord.gptModel,
      initial_visit_additional_preferences: settingsRecord.initialVisitPrompt,
      follow_up_visit_additional_preferences: settingsRecord.followUpVisitPrompt,
      auto_save: settingsRecord.autoSave,
      provider_name: settingsRecord.providerName,
      email: settingsRecord.email,
      user_id: settingsRecord.userId,
      updated_at: settingsRecord.updatedAt.toISOString(),
    } as SupabaseSettings;
  }

  return null;
}
