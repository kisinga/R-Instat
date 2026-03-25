/**
 * Chat Tab — unified AI interaction container.
 *
 * Replaces the education tab. Handles both educational questions
 * and action intents in a single conversation flow.
 */

import {
  Component,
  inject,
  signal,
  ElementRef,
  ViewChild,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ChatStoreService } from '../../../core/services/chat-store.service';
import { ChatRouterService } from '../../../core/services/chat-router.service';
import { StepExecutorService } from '../../../core/services/step-executor.service';
import { AppStateService } from '../../../core/services/app-state.service';
import type { ResolvedPlanStep } from '../../../core/services/intent-resolver.service';
import { ChatUserMessageComponent } from './messages/chat-user-message.component';
import { ChatEducationMessageComponent } from './messages/chat-education-message.component';
import { ChatPlanMessageComponent } from './messages/chat-plan-message.component';
import { ChatCodeMessageComponent } from './messages/chat-code-message.component';
import { ChatDisambiguationMessageComponent } from './messages/chat-disambiguation-message.component';
import { ChatErrorMessageComponent } from './messages/chat-error-message.component';

@Component({
  selector: 'app-chat-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ChatUserMessageComponent,
    ChatEducationMessageComponent,
    ChatPlanMessageComponent,
    ChatCodeMessageComponent,
    ChatDisambiguationMessageComponent,
    ChatErrorMessageComponent,
  ],
  template: `
    <div class="flex flex-col h-full">
      <!-- Header -->
      <div class="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-base-300 bg-base-200/50">
        <div class="flex items-center gap-2 min-w-0">
          <!-- Conversation picker dropdown -->
          <div class="dropdown dropdown-bottom">
            <div tabindex="0" role="button" class="btn btn-ghost btn-xs gap-1">
              <span class="truncate max-w-[180px] text-xs">
                {{ store.activeConversation()?.title ?? ('AI_CHAT.NEW_CONVERSATION' | translate) }}
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
                    >
                      <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </button>
                </li>
              }
              @if (store.conversations().length === 0) {
                <li class="disabled"><span class="text-xs opacity-50">{{ 'AI_CHAT.NO_CONVERSATIONS' | translate }}</span></li>
              }
            </ul>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <!-- Settings button -->
          <button
            class="btn btn-ghost btn-xs"
            (click)="openSettings()"
            [title]="'AI_CHAT.SETTINGS' | translate"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <!-- New chat button -->
          <button
            class="btn btn-ghost btn-xs"
            (click)="onNewConversation()"
            [title]="'AI_CHAT.NEW_CONVERSATION' | translate"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Messages area -->
      <div #messagesContainer class="flex-1 min-h-0 overflow-y-auto px-2 py-4 space-y-1">
        @if (!store.activeConversation() || store.activeConversation()!.messages.length === 0) {
          <div class="text-center text-base-content/50 py-12">
            <div class="text-3xl mb-2">&#129302;</div>
            <p class="text-sm">{{ 'AI_CHAT.EMPTY_MESSAGE' | translate }}</p>
            <p class="text-xs opacity-70">{{ 'AI_CHAT.EMPTY_HINT' | translate }}</p>
          </div>
        } @else {
          @for (msg of store.activeConversation()!.messages; track msg.id) {
            @switch (msg.payload.type) {
              @case ('text') {
                @if (msg.role === 'user') {
                  <app-chat-user-message [message]="msg" />
                }
              }
              @case ('education') {
                <app-chat-education-message
                  [message]="msg"
                  (openDialog)="onOpenDialog($event)"
                  (sendFollowUp)="onSendFollowUp($event)"
                />
              }
              @case ('action-plan') {
                <app-chat-plan-message
                  [message]="msg"
                  (executeStep)="onExecuteStep($event)"
                  (toggleConfirm)="onToggleConfirm($event)"
                />
              }
              @case ('code-result') {
                <app-chat-code-message [message]="msg" />
              }
              @case ('disambiguation') {
                <app-chat-disambiguation-message
                  [message]="msg"
                  (sendClarification)="onSendFollowUp($event)"
                />
              }
              @case ('error') {
                <app-chat-error-message [message]="msg" />
              }
            }
          }
          @if (router.isLoading()) {
            <div class="chat chat-start">
              <div class="chat-bubble chat-bubble-ghost">
                <span class="loading loading-dots loading-sm"></span>
              </div>
            </div>
          }
        }
      </div>

      <!-- Input area -->
      <div class="flex-shrink-0 p-3 border-t border-base-300 bg-base-100">
        <div class="flex gap-2">
          <textarea
            class="textarea textarea-bordered textarea-sm flex-1 min-h-[2.5rem] max-h-24 resize-none"
            [placeholder]="'AI_CHAT.INPUT_PLACEHOLDER' | translate"
            [ngModel]="userInput()"
            (ngModelChange)="userInput.set($event)"
            (keydown.enter)="onEnterKey($event)"
            [disabled]="router.isLoading()"
            rows="1"
          ></textarea>
          <button
            class="btn btn-primary btn-sm self-end"
            (click)="send()"
            [disabled]="!userInput().trim() || router.isLoading()"
          >
            @if (router.isLoading()) {
              <span class="loading loading-spinner loading-xs"></span>
            } @else {
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            }
          </button>
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
export class ChatTabComponent implements AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLElement>;

  readonly store = inject(ChatStoreService);
  readonly router = inject(ChatRouterService);
  private readonly stepExecutor = inject(StepExecutorService);
  private readonly appState = inject(AppStateService);

  readonly userInput = signal('');
  private shouldScrollToBottom = false;

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  async send(): Promise<void> {
    const input = this.userInput().trim();
    if (!input || this.router.isLoading()) return;

    this.userInput.set('');
    this.shouldScrollToBottom = true;

    await this.router.send(input);
    this.shouldScrollToBottom = true;
  }

  onSendFollowUp(text: string): void {
    this.userInput.set(text);
    this.send();
  }

  onNewConversation(): void {
    this.store.newConversation();
    this.userInput.set('');
  }

  onOpenDialog(dialogId: string): void {
    this.appState.openDialog(dialogId);
  }

  async onExecuteStep(step: ResolvedPlanStep): Promise<void> {
    if (step.kind === 'dialog') {
      await this.stepExecutor.executeDialogStep(step);
    } else if (step.kind === 'code') {
      await this.stepExecutor.executeCodeStep(step);
      this.shouldScrollToBottom = true;
    }
  }

  onToggleConfirm(_event: { stepId: string; checked: boolean }): void {
    // Plan message components manage their own confirmation state
  }

  openSettings(): void {
    this.appState.openDialog('ai-settings');
  }

  onEnterKey(event: Event): void {
    const ke = event as KeyboardEvent;
    if (ke.shiftKey) return;
    ke.preventDefault();
    this.send();
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
