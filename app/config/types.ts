export interface SystemMessage {
  content: string;
  version: string;
  lastUpdated: string;
  description: string;
}

export interface SystemMessages {
  initialVisit: SystemMessage;
  followUpVisit: SystemMessage;
}

export interface SystemMessageUpdate {
  content: string;
  description?: string;
} 