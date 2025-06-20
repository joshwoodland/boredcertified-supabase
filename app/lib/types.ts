export interface MedicationEvent {
  medId: string;
  medName: string;               // "Sertraline"
  date: string;                  // ISO
  type: "start" | "dose-change" | "stop";
  doseMg?: number;               // null for stop
  note?: string;                 // discontinuation reason
}

export interface MedicationSummary {
  medId: string;
  medName: string;
  isActive: boolean;
  lastDoseMg?: number;
  lastChangeDate: string;        // ISO
  stopReason?: string;
}

export interface OutcomeMarker {
  medId: string;
  date: string;                  // ISO
  scale: "PHQ-9" | "GAD-7";
  score: number;                 // raw score
  percentChange: number;         // e.g. -55
}

export interface MedGuideline {
  medName: string;
  recommendedMaxMg: number;      // e.g. 200 mg
}

export interface MedicationTimelineData {
  events: MedicationEvent[];
  summaries: MedicationSummary[];
  outcomeMarkers: OutcomeMarker[];
  guidelines: MedGuideline[];
  appointmentDots: AppointmentDot[];
}

export interface MedicationSpan {
  medId: string;
  medName: string;
  startDate: Date;
  endDate?: Date;
  doseMg?: number;
  isActive: boolean;
  stopReason?: string;
}

export interface TaperPlan {
  date: string;
  doseMg: number;
  weekNumber: number;
  notes?: string;
}

export interface AppointmentDot {
  medId: string;
  medName: string;
  date: string;                  // ISO
  doseMg: number;
  appointmentType?: string;      // "follow-up" | "initial" | "check-in"
}

export interface MedicationPoint {
  date: Date;
  doseMg: number;
  isAppointment: boolean;
  appointmentType?: string;
}

export interface MedicationLine {
  medId: string;
  medName: string;
  color: string;
  points: Array<{
    date: Date;
    doseMg: number;
    isAppointment: boolean;
    appointmentType?: string;
  }>;
  startedOverYearAgo?: boolean;
  isActive: boolean;
} 