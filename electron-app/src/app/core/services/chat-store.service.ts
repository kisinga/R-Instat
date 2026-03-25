/**
 * Chat Store Service — conversation state management.
 *
 * Replaces EducationStoreService. Manages unified ChatConversation
 * with typed MessagePayload discriminated unions.
 * Persists to localStorage.
 */

import { Injectable, signal, computed } from '@angular/core';
import type {
  ChatMessage,
  ChatConversation,
  MessagePayload,
  SystemHighlight,
} from '../models/chat.model';
import type { ResolvedPlan } from './intent-resolver.service';

const STORAGE_KEY = 'r-instat-ai-chats';
const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 100;

@Injectable({ providedIn: 'root' })
export class ChatStoreService {
  private readonly _conversations = signal<ChatConversation[]>([]);
  private readonly _activeConversationId = signal<string | null>(null);

  readonly conversations = this._conversations.asReadonly();
  readonly activeConversationId = this._activeConversationId.asReadonly();

  readonly activeConversation = computed(() => {
    const id = this._activeConversationId();
    if (!id) return null;
    return this._conversations().find(c => c.id === id) ?? null;
  });

  constructor() {
    this.loadFromStorage();
  }

  appendUserMessage(text: string): void {
    this.ensureActiveConversation();
    this.appendMessage(text, 'user', { type: 'text' });
  }

  appendEducationMessage(
    content: string,
    highlights: SystemHighlight[],
    followUpSuggestions: string[]
  ): void {
    this.appendMessage(content, 'assistant', {
      type: 'education',
      highlights,
      followUpSuggestions,
    });
  }

  appendPlanMessage(content: string, plan: ResolvedPlan): void {
    this.appendMessage(content, 'assistant', { type: 'action-plan', plan });
  }

  appendCodeResultMessage(script: string, output: string | undefined, success: boolean): void {
    this.appendMessage(
      success ? 'Code executed successfully.' : 'Code execution failed.',
      'assistant',
      { type: 'code-result', script, output, success }
    );
  }

  appendDisambiguationMessage(suggestions: Array<{ text: string; category: string }>): void {
    this.appendMessage(
      'I need a bit more context to help you. What would you like to do?',
      'assistant',
      { type: 'disambiguation', suggestions }
    );
  }

  appendErrorMessage(content: string, detail?: string): void {
    this.appendMessage(content, 'assistant', { type: 'error', errorDetail: detail });
  }

  newConversation(): void {
    const id = this.generateId();
    const conversation: ChatConversation = {
      id,
      title: 'New conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this._conversations.update(convs => {
      const updated = [conversation, ...convs];
      return updated.slice(0, MAX_CONVERSATIONS);
    });
    this._activeConversationId.set(id);
    this.saveToStorage();
  }

  switchConversation(id: string): void {
    this._activeConversationId.set(id);
  }

  deleteConversation(id: string): void {
    this._conversations.update(convs => convs.filter(c => c.id !== id));
    if (this._activeConversationId() === id) {
      const remaining = this._conversations();
      this._activeConversationId.set(remaining.length > 0 ? remaining[0].id : null);
    }
    this.saveToStorage();
  }

  private ensureActiveConversation(): void {
    if (!this._activeConversationId() || !this.activeConversation()) {
      this.newConversation();
    }
  }

  private appendMessage(content: string, role: ChatMessage['role'], payload: MessagePayload): void {
    const message: ChatMessage = {
      id: this.generateId(),
      role,
      content,
      timestamp: Date.now(),
      payload,
    };

    const activeId = this._activeConversationId();
    this._conversations.update(convs =>
      convs.map(c => {
        if (c.id !== activeId) return c;

        const messages = [...c.messages, message].slice(-MAX_MESSAGES_PER_CONVERSATION);
        const title = c.messages.length === 0 && role === 'user'
          ? content.slice(0, 60) + (content.length > 60 ? '...' : '')
          : c.title;

        return { ...c, messages, title, updatedAt: Date.now() };
      })
    );
    this.saveToStorage();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { conversations: ChatConversation[]; activeId: string | null };
      if (Array.isArray(parsed.conversations)) {
        this._conversations.set(parsed.conversations);
        this._activeConversationId.set(parsed.activeId ?? parsed.conversations[0]?.id ?? null);
      }
    } catch {
      // Graceful degradation
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        conversations: this._conversations(),
        activeId: this._activeConversationId(),
      }));
    } catch {
      // localStorage may be unavailable
    }
  }
}
