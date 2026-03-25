/**
 * Education Tab — Smart container component.
 *
 * Manages education conversations: renders message list, input area,
 * conversation picker. Orchestrates EducationPipeline and EducationStoreService.
 */

import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { EducationStoreService } from '../../../core/services/education-store.service';
import { EducationPipeline } from '../../../core/ai/pipeline/education-pipeline';
import { RService } from '../../../core/services/r.service';
import { AppStateService } from '../../../core/services/app-state.service';
import { AIConfigService } from '../../../core/services/ai-config.service';
import { LanguageService } from '../../../core/services/language.service';
import { enrichHighlights } from '../../../core/ai/highlight-enricher';
import { DialogMenuResolver, STANDARD_MENU_GROUPS } from '../../../core/ai/dialog-menu-resolver';
import { EducationMessageComponent } from './education-message.component';
import type { DataContext } from '../../../core/ai/types/data-context.types';

@Component({
  selector: 'app-education-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, EducationMessageComponent],
  template: `
    <div class="flex flex-col h-full">
      <!-- Header -->
      <div class="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-base-300 bg-base-200/50">
        <div class="flex items-center gap-2 min-w-0">
          <!-- Conversation picker dropdown -->
          <div class="dropdown dropdown-bottom">
            <div tabindex="0" role="button" class="btn btn-ghost btn-xs gap-1">
              <span class="truncate max-w-[180px] text-xs">
                {{ activeConversation()?.title ?? ('EDUCATION.NEW_CONVERSATION' | translate) }}
              </span>
              <svg class="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <ul tabindex="0" class="dropdown-content z-10 menu menu-sm p-2 shadow bg-base-100 rounded-box w-60 max-h-48 overflow-y-auto">
              @for (conv of store.conversations(); track conv.id) {
                <li>
                  <button
                    class="flex items-center justify-between text-xs"
                    [class.active]="conv.id === store.activeConversationId()"
                    (click)="store.switchConversation(conv.id)"
                  >
                    <span class="truncate">{{ conv.title }}</span>
                    <button
                      class="btn btn-ghost btn-xs btn-circle opacity-50 hover:opacity-100"
                      (click)="$event.stopPropagation(); store.deleteConversation(conv.id)"
                      [title]="'EDUCATION.DELETE' | translate"
                    >
                      <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </button>
                </li>
              }
              @if (store.conversations().length === 0) {
                <li class="disabled"><span class="text-xs opacity-50">{{ 'EDUCATION.NO_CONVERSATIONS' | translate }}</span></li>
              }
            </ul>
          </div>
        </div>

        <!-- New chat button -->
        <button
          class="btn btn-ghost btn-xs"
          (click)="onNewConversation()"
          [title]="'EDUCATION.NEW_CONVERSATION' | translate"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <!-- Messages area -->
      <div #messagesContainer class="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        @if (!activeConversation() || activeConversation()!.messages.length === 0) {
          <div class="text-center text-base-content/50 py-12">
            <div class="text-3xl mb-2">&#128218;</div>
            <p class="text-sm">{{ 'EDUCATION.EMPTY_MESSAGE' | translate }}</p>
            <p class="text-xs opacity-70">{{ 'EDUCATION.EMPTY_HINT' | translate }}</p>
          </div>
        } @else {
          @for (msg of activeConversation()!.messages; track msg.id) {
            <app-education-message
              [message]="msg"
              (openDialog)="onOpenDialog($event)"
              (sendFollowUp)="onSendFollowUp($event)"
            />
          }
          @if (isLoading()) {
            <div class="flex justify-start">
              <div class="bg-base-200 rounded-lg px-4 py-3 border border-base-300">
                <span class="loading loading-dots loading-sm"></span>
              </div>
            </div>
          }
        }
      </div>

      <!-- Input area -->
      <div class="flex-shrink-0 p-3 border-t border-base-300 bg-base-100">
        @if (errorMessage()) {
          <div class="alert alert-error alert-sm mb-2 py-1 text-xs">
            <span>{{ errorMessage() }}</span>
          </div>
        }
        <div class="flex gap-2">
          <textarea
            class="textarea textarea-bordered textarea-sm flex-1 min-h-[2.5rem] max-h-24 resize-none"
            [placeholder]="'EDUCATION.INPUT_PLACEHOLDER' | translate"
            [ngModel]="userInput()"
            (ngModelChange)="userInput.set($event)"
            (keydown.enter)="onEnterKey($event)"
            [disabled]="isLoading()"
            rows="1"
          ></textarea>
          <button
            class="btn btn-primary btn-sm self-end"
            (click)="send()"
            [disabled]="!userInput().trim() || isLoading()"
          >
            @if (isLoading()) {
              <span class="loading loading-spinner loading-xs"></span>
            } @else {
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            }
          </button>
        </div>
        <div class="text-xs text-base-content/40 mt-1">
          {{ aiConfig.provider() === 'claude' ? 'Claude' : 'OpenAI' }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
  `],
})
export class EducationTabComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLElement>;

  readonly store = inject(EducationStoreService);
  readonly aiConfig = inject(AIConfigService);
  private readonly pipeline = inject(EducationPipeline);
  private readonly rService = inject(RService);
  private readonly appState = inject(AppStateService);
  private readonly languageService = inject(LanguageService);

  readonly activeConversation = this.store.activeConversation;
  readonly userInput = signal('');
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  private menuResolver: DialogMenuResolver | null = null;
  private shouldScrollToBottom = false;

  ngOnInit(): void {
    this.menuResolver = new DialogMenuResolver(
      STANDARD_MENU_GROUPS,
      (key: string) => this.languageService.instant(key)
    );
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  async send(): Promise<void> {
    const input = this.userInput().trim();
    if (!input || this.isLoading()) return;

    this.userInput.set('');
    this.errorMessage.set('');

    this.store.appendUserMessage(input);
    this.shouldScrollToBottom = true;
    this.isLoading.set(true);

    try {
      const dataContext = await this.buildDataContext();
      const history = this.buildHistory();

      const result = await this.pipeline.execute(input, dataContext, history);

      if (result.success && result.response) {
        const highlights = this.menuResolver
          ? enrichHighlights(result.response.highlights, this.menuResolver)
          : [];

        this.store.appendAssistantMessage(
          result.response.explanation,
          highlights,
          result.response.followUpSuggestions
        );
      } else {
        this.errorMessage.set(result.error ?? 'Failed to get response.');
      }
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.isLoading.set(false);
      this.shouldScrollToBottom = true;
    }
  }

  onSendFollowUp(text: string): void {
    this.userInput.set(text);
    this.send();
  }

  onNewConversation(): void {
    this.store.newConversation();
    this.userInput.set('');
    this.errorMessage.set('');
  }

  onOpenDialog(dialogId: string): void {
    this.appState.openDialog(dialogId);
  }

  onEnterKey(event: Event): void {
    const ke = event as KeyboardEvent;
    if (ke.shiftKey) return; // allow Shift+Enter for newline
    ke.preventDefault();
    this.send();
  }

  private async buildDataContext(): Promise<DataContext> {
    const dataframes = this.rService.dataframes();
    const active = this.rService.activeDataframe();
    const columnsByDataframe: Record<string, Array<{ name: string; type: string }>> = {};
    for (const df of dataframes) {
      try {
        const colInfo = await this.rService.getColumnInfo(df);
        columnsByDataframe[df] = colInfo.map(c => ({ name: c.name, type: c.type }));
      } catch {
        columnsByDataframe[df] = [];
      }
    }
    const df = active && dataframes.includes(active) ? active : dataframes[0] ?? null;
    return { dataframes, activeDataframe: df, columnsByDataframe };
  }

  private buildHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    const conv = this.activeConversation();
    if (!conv) return [];
    // Last 6 messages for context
    return conv.messages.slice(-6).map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
