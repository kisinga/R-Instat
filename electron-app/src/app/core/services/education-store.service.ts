/**
 * Education Store Service — State + localStorage persistence for education conversations.
 * No AI logic. Mirrors the AIConfigService persistence pattern.
 */

import { Injectable, signal, computed } from '@angular/core';
import type {
  EducationConversation,
  EducationMessage,
  SystemHighlight,
} from '../models/education-chat.model';

const STORAGE_KEY = 'r-instat-education-chats';
const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 100;

@Injectable({ providedIn: 'root' })
export class EducationStoreService {
  private readonly _conversations = signal<EducationConversation[]>([]);
  private readonly _activeConversationId = signal<string | null>(null);

  readonly conversations = this._conversations.asReadonly();
  readonly activeConversationId = this._activeConversationId.asReadonly();

  readonly activeConversation = computed<EducationConversation | null>(() => {
    const id = this._activeConversationId();
    if (!id) return null;
    return this._conversations().find(c => c.id === id) ?? null;
  });

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Append a user message to the active conversation (creates one if none exists).
   */
  appendUserMessage(text: string): EducationMessage {
    this.ensureActiveConversation();

    const message: EducationMessage = {
      id: this.generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    this.addMessageToActive(message);

    // Update title from first user message
    const active = this.activeConversation();
    if (active && active.messages.filter(m => m.role === 'user').length === 1) {
      this.updateConversation(active.id, {
        title: text.slice(0, 60) + (text.length > 60 ? '...' : ''),
      });
    }

    return message;
  }

  /**
   * Append an assistant message to the active conversation.
   */
  appendAssistantMessage(
    content: string,
    highlights?: SystemHighlight[],
    followUpSuggestions?: string[]
  ): EducationMessage {
    const message: EducationMessage = {
      id: this.generateId(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      highlights: highlights?.length ? highlights : undefined,
      followUpSuggestions: followUpSuggestions?.length ? followUpSuggestions : undefined,
    };

    this.addMessageToActive(message);
    return message;
  }

  /**
   * Create a new empty conversation and make it active.
   */
  newConversation(): string {
    const id = this.generateId();
    const now = Date.now();
    const conversation: EducationConversation = {
      id,
      title: 'New conversation',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    this._conversations.update(convs => [conversation, ...convs].slice(0, MAX_CONVERSATIONS));
    this._activeConversationId.set(id);
    this.persist();
    return id;
  }

  switchConversation(id: string): void {
    const exists = this._conversations().some(c => c.id === id);
    if (exists) {
      this._activeConversationId.set(id);
    }
  }

  deleteConversation(id: string): void {
    this._conversations.update(convs => convs.filter(c => c.id !== id));
    if (this._activeConversationId() === id) {
      const remaining = this._conversations();
      this._activeConversationId.set(remaining.length > 0 ? remaining[0].id : null);
    }
    this.persist();
  }

  private ensureActiveConversation(): void {
    if (!this._activeConversationId() || !this.activeConversation()) {
      this.newConversation();
    }
  }

  private addMessageToActive(message: EducationMessage): void {
    const activeId = this._activeConversationId();
    if (!activeId) return;

    this._conversations.update(convs =>
      convs.map(c => {
        if (c.id !== activeId) return c;
        const messages = [...c.messages, message].slice(-MAX_MESSAGES_PER_CONVERSATION);
        return { ...c, messages, updatedAt: Date.now() };
      })
    );
    this.persist();
  }

  private updateConversation(
    id: string,
    updates: Partial<Pick<EducationConversation, 'title'>>
  ): void {
    this._conversations.update(convs =>
      convs.map(c => (c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c))
    );
    this.persist();
  }

  private persist(): void {
    try {
      const data = this._conversations();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable — silently degrade
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      this._conversations.set(parsed.slice(0, MAX_CONVERSATIONS));

      // Restore active to the most recent conversation
      if (parsed.length > 0) {
        this._activeConversationId.set(parsed[0].id);
      }
    } catch {
      // Corrupt data — start fresh
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
