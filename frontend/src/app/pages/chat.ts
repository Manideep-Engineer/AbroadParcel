import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth, UsdPipe, errorMessage } from '../core/api';

interface ConversationSummary {
  id: string;
  listingTitle: string;
  fromAirport: string;
  toAirport: string;
  otherName: string;
  lastMessage: string | null;
}

interface ChatMessage {
  id: string;
  body: string;
  sentAt: string;
  senderId: string;
}

interface Conversation {
  id: string;
  role: 'Sender' | 'Traveler';
  listing: { id: string; title: string; weightKg: number; status: string };
  trip: { id: string; fromAirport: string; toAirport: string; flightDate: string };
  otherName: string;
  otherId: string;
  bookingId: string | null;
  bookingStatus: string | null;
  messages: ChatMessage[];
}

interface Profile {
  reviewCount: number;
  averageRating: number | null;
}

@Component({
  selector: 'app-chat',
  imports: [FormsModule, RouterLink, RouterLinkActive, DatePipe, UsdPipe],
  template: `
    <div class="page wrap" style="padding-bottom: 50px">
      <div class="page-head"><h1>Messages</h1></div>
      @if (error()) {
        <div class="alert alert-error" role="alert" style="margin-bottom: 16px">{{ error() }}</div>
      }
      <div class="chat">
        <aside class="chat-list">
          @for (c of conversations(); track c.id) {
            <a class="chat-item" [routerLink]="['/chat', c.id]" routerLinkActive="active">
              <b>{{ c.otherName }}</b>
              <p class="small muted mono">{{ c.fromAirport }} → {{ c.toAirport }} · {{ c.listingTitle }}</p>
              <p class="small muted">{{ c.lastMessage ?? 'No messages yet' }}</p>
            </a>
          } @empty {
            <div style="padding: 24px" class="muted small">No chats yet. <a routerLink="/browse">Browse trips and parcels</a> to start one.</div>
          }
        </aside>

        <section class="chat-main">
          @if (active(); as c) {
            <header class="chat-head row between">
              <div>
                <b>{{ c.otherName }}</b>
                @if (profile(); as p) {
                  <span class="small muted"> · {{ p.averageRating ? '★ ' + p.averageRating + ' (' + p.reviewCount + ')' : 'No reviews yet' }}</span>
                }
                <p class="small muted mono">{{ c.trip.fromAirport }} → {{ c.trip.toAirport }} · {{ c.trip.flightDate | date: 'd MMM y' : 'UTC' }} · {{ c.listing.title }}</p>
              </div>
              <div class="row">
                @if (c.bookingId) {
                  <a class="btn btn-sm" [routerLink]="['/bookings', c.bookingId]">View delivery</a>
                }
                @if (c.role === 'Sender' && c.listing.status === 'Open' && canPropose(c.bookingStatus)) {
                  <button type="button" class="btn btn-sm btn-signal" (click)="showProposal.set(true)">Propose terms</button>
                }
              </div>
            </header>
            <div class="chat-log" #log aria-live="polite">
              @for (m of c.messages; track m.id) {
                <div class="bubble" [class.mine]="m.senderId === auth.user()?.id">
                  {{ m.body }}
                  <time>{{ m.sentAt | date: 'd MMM, h:mm a' }}</time>
                </div>
              } @empty {
                <p class="muted small" style="margin: auto">Say hello, then agree the fee, item details and a meeting place near the airport.</p>
              }
            </div>
            <form ngNativeValidate class="chat-send" (ngSubmit)="send()">
              <input name="draft" aria-label="Message" placeholder="Write a message" maxlength="2000" autocomplete="off" [(ngModel)]="draft" />
              <button type="submit" class="btn btn-ink" [disabled]="!draft.trim()">Send</button>
            </form>
          } @else {
            <div class="muted" style="margin: auto; padding: 40px; text-align: center">Choose a chat to start.</div>
          }
        </section>
      </div>
    </div>

    @if (showProposal() && active(); as c) {
      <div class="overlay" (click)="showProposal.set(false)">
        <form ngNativeValidate class="dialog stack" role="dialog" aria-modal="true" aria-label="Propose delivery terms" (click)="$event.stopPropagation()" (ngSubmit)="propose(c.id)">
          <h3>Propose delivery terms</h3>
          @if (proposalError()) {
            <div class="alert alert-error" role="alert">{{ proposalError() }}</div>
          }
          <label class="field">Delivery fee (USD)
            <input name="fee" type="number" min="1" step="0.01" required [ngModel]="fee()" (ngModelChange)="setFee($event)" />
            @if (processing() !== null) {
              <span class="hint">Plus a {{ processing() | usd }} processing fee paid by you. It isn't refunded after a decline or flight cancellation.</span>
            }
          </label>
          <label class="field">Handover place near the departure airport
            <input name="place" required maxlength="200" [(ngModel)]="meetingPlace" placeholder="Where you'll give the item to the traveler" />
          </label>
          <label class="field">Handover date and time
            <input name="when" type="datetime-local" required [(ngModel)]="meetingAt" />
          </label>
          <label class="field">Pickup place near the destination airport
            <input name="pickup" required maxlength="200" [(ngModel)]="pickupPlace" placeholder="Where the recipient will collect the item" />
          </label>
          <label class="field">Recipient's name
            <input name="recipient" required maxlength="120" [(ngModel)]="recipientName" />
          </label>
          <label class="field">Recipient's phone, with country code
            <input name="recipientPhone" type="tel" required maxlength="30" [(ngModel)]="recipientPhone" />
            <span class="hint">They'll get a link with delivery details by SMS or WhatsApp.</span>
          </label>
          <div class="row">
            <button type="submit" class="btn btn-signal" [disabled]="proposing()">Send proposal</button>
            <button type="button" class="btn" (click)="showProposal.set(false)">Cancel</button>
          </div>
        </form>
      </div>
    }
  `,
})
export class Chat implements OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  protected auth = inject(Auth);

  readonly id = input<string>();
  private log = viewChild<ElementRef<HTMLElement>>('log');

  protected conversations = signal<ConversationSummary[]>([]);
  protected active = signal<Conversation | null>(null);
  protected profile = signal<Profile | null>(null);
  protected error = signal('');
  protected draft = '';

  protected showProposal = signal(false);
  protected fee = signal<number | null>(null);
  protected processing = signal<number | null>(null);
  protected meetingPlace = '';
  protected meetingAt = '';
  protected pickupPlace = '';
  protected recipientName = '';
  protected recipientPhone = '';
  protected proposing = signal(false);
  protected proposalError = signal('');

  private poll = setInterval(() => this.refresh(), 5000);
  private lastCount = -1;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.active.set(null);
        this.profile.set(null);
        this.lastCount = -1;
        this.refresh(id);
      });
    });
  }

  ngOnDestroy() {
    clearInterval(this.poll);
  }

  private async refresh(id = this.id()) {
    try {
      this.conversations.set(await firstValueFrom(this.http.get<ConversationSummary[]>('/api/conversations')));
      if (!id) return;
      const conversation = await firstValueFrom(this.http.get<Conversation>(`/api/conversations/${id}`));
      if (id !== this.id()) return;
      if (!this.profile()) {
        this.profile.set(await firstValueFrom(this.http.get<Profile>(`/api/users/${conversation.otherId}/profile`)));
      }
      this.active.set(conversation);
      if (conversation.messages.length !== this.lastCount) {
        this.lastCount = conversation.messages.length;
        setTimeout(() => this.scrollToEnd());
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected canPropose(status: string | null) {
    return !status || ['Rejected', 'Declined', 'Cancelled'].includes(status);
  }

  private scrollToEnd() {
    const el = this.log()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  protected async send() {
    const c = this.active();
    const body = this.draft.trim();
    if (!c || !body) return;
    this.draft = '';
    try {
      await firstValueFrom(this.http.post(`/api/conversations/${c.id}/messages`, { body }));
      await this.refresh();
    } catch (e) {
      this.draft = body;
      this.error.set(errorMessage(e));
    }
  }

  protected async setFee(value: number | null) {
    this.fee.set(value);
    if (!value || value < 1) {
      this.processing.set(null);
      return;
    }
    const cents = Math.round(value * 100);
    try {
      const preview = await firstValueFrom(this.http.get<{ processingFeeCents: number }>(`/api/bookings/fee-preview?deliveryFeeCents=${cents}`));
      if (this.fee() === value) this.processing.set(preview.processingFeeCents);
    } catch {
      this.processing.set(null);
    }
  }

  protected async propose(conversationId: string) {
    this.proposing.set(true);
    this.proposalError.set('');
    try {
      const { id } = await firstValueFrom(
        this.http.post<{ id: string }>('/api/bookings', {
          conversationId,
          deliveryFeeCents: Math.round((this.fee() ?? 0) * 100),
          meetingPlace: this.meetingPlace,
          meetingAt: new Date(this.meetingAt).toISOString(),
          pickupPlace: this.pickupPlace,
          recipientName: this.recipientName,
          recipientPhone: this.recipientPhone,
        }),
      );
      this.router.navigate(['/bookings', id]);
    } catch (e) {
      this.proposalError.set(errorMessage(e));
    } finally {
      this.proposing.set(false);
    }
  }
}
