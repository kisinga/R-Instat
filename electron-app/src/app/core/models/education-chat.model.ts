/**
 * Data model for education chat conversations.
 */

export interface SystemHighlight {
  dialogId: string;
  dialogLabel: string;
  family: string;
  menuPath: string[];
  relevanceNote: string;
}

export interface EducationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  highlights?: SystemHighlight[];
  followUpSuggestions?: string[];
}

export interface EducationConversation {
  id: string;
  title: string;
  messages: EducationMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface EducationAIResponse {
  explanation: string;
  highlights: Array<{ dialogId: string; relevanceNote: string }>;
  followUpSuggestions: string[];
}
