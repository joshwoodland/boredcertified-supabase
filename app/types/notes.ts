export interface Note {
  id: string;
  patientId: string;
  transcript: string;
  content: string;
  summary: string | null;
  isInitialVisit: boolean;
  createdAt: Date;
  updatedAt: Date;
}