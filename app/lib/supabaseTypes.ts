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
}

export interface SupabaseSettings {
  id: string;
  dark_mode: boolean;
  gpt_model: string;
  initial_visit_prompt: string;
  follow_up_visit_prompt: string;
  auto_save: boolean;
  low_echo_cancellation: boolean;
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
  lowEchoCancellation: boolean;
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
    } as AppNote;
  }

  if (type === 'settings') {
    const settingsRecord = record as SupabaseSettings;
    return {
      id: settingsRecord.id,
      darkMode: settingsRecord.dark_mode,
      gptModel: settingsRecord.gpt_model,
      initialVisitPrompt: settingsRecord.initial_visit_prompt,
      followUpVisitPrompt: settingsRecord.follow_up_visit_prompt,
      autoSave: settingsRecord.auto_save,
      lowEchoCancellation: settingsRecord.low_echo_cancellation,
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
    } as SupabaseNote;
  }

  if (type === 'settings') {
    const settingsRecord = record as AppSettings;
    return {
      id: settingsRecord.id,
      dark_mode: settingsRecord.darkMode,
      gpt_model: settingsRecord.gptModel,
      initial_visit_prompt: settingsRecord.initialVisitPrompt,
      follow_up_visit_prompt: settingsRecord.followUpVisitPrompt,
      auto_save: settingsRecord.autoSave,
      low_echo_cancellation: settingsRecord.lowEchoCancellation,
      email: settingsRecord.email,
      user_id: settingsRecord.userId,
      updated_at: settingsRecord.updatedAt.toISOString(),
    } as SupabaseSettings;
  }

  return null;
}
