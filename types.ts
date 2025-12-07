export interface Classification {
  category: string;
  domain: string;
  urgency: number;
  reason: string;
}

export interface ExtractedField {
  field: string;
  value: string;
  confidence: number;
}

export interface ActionContent {
  to?: string;
  subject?: string;
  body?: string;
  headers?: string[];
  row?: string[];
  message?: string;
  channel?: string;
  recipient?: string;
}

export interface GeneratedAction {
  label: string;
  action_type: 'email' | 'sheet' | 'slack_message' | 'save_pdf';
  enabled: boolean;
  tooltip: string;
  content: ActionContent;
}

export interface Actions {
  primary: string;
  secondary: string[];
  workflow: string[];
  generatedActions: GeneratedAction[];
}

export interface AnalysisResult {
  id: string;
  timestamp: number;
  classification: Classification;
  extraction: ExtractedField[];
  actions: Actions;
  summary: string;
}

export interface DocumentInput {
  file: File | null;
  text: string;
  type: 'file' | 'text';
  base64?: string;
  mimeType?: string;
}

export enum AppMode {
  DOCUMENT = 'DOCUMENT',
  LIVE = 'LIVE'
}

export type AgentStage = 'idle' | 'ingestion' | 'classification' | 'extraction' | 'action' | 'complete' | 'error';