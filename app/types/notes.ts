export interface Note {
  id: string;
  patientId: string;
  transcript: string;
  content: string;
  summary: string | null;
  isInitialVisit: boolean;
  createdAt: Date;
  updatedAt: Date;
  checklistContent?: any; // JSON field for storing follow-up checklist items
  sourceNoteId?: string | null; // Reference to the note this checklist was generated from
}