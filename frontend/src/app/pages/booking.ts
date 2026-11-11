import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Booking, UsdPipe, errorMessage } from '../core/api';
import { StatusBadge } from './status-badge';

const STAGES = [
  { status: 'Proposed', label: 'TERMS' },
  { status: 'AwaitingPayment', label: 'PAYMENT' },
  { status: 'Held', label: 'HANDOVER' },
  { status: 'HandedOver', label: 'IN TRANSIT' },
  { status: 'Delivered', label: 'DELIVERED' },
];

@Component({
  selector: 'app-booking',
  imports: [FormsModule, RouterLink, DatePipe, UsdPipe, StatusBadge],
  template: `
    <div class="page wrap">
      @if (booking(); as b) {
        <div class="page-head">
          <div>
            <span class="eyebrow">{{ b.trip.fromAirport }} → {{ b.trip.toAirport }} · {{ b.trip.flightDate | date: 'd MMM y' : 'UTC' }}</span>
            <h1 style="margin-top: 10px">{{ b.listing.title }}</h1>
          </div>
          <div class="row">
            <app-status [status]="b.status" />
            <a class="btn btn-sm" [routerLink]="['/chat', b.conversationId]">Open chat</a>
          </div>
        </div>

        @if (stageIndex() >= 0) {
          <div class="progress" role="list" aria-label="Delivery progress">
            @for (s of stages; track s.status; let i = $index) {
              <div role="listitem" [class.done]="i < stageIndex() || b.status === 'Delivered'" [class.now]="i === stageIndex() && b.status !== 'Delivered'">{{ s.label }}</div>
            }
          </div>
        }

        @if (error()) {
          <div class="alert alert-error" role="alert" style="margin-bottom: 18px">{{ error() }}</div>
        }

        <div class="split">
          <div class="stack">
            <section class="card action-card stack">
              @switch (b.status) {
                @case ('Proposed') {
                  @if (b.role === 'Traveler') {
                    <h3>{{ b.senderName }} proposed these terms</h3>
                    <p>Accept if the fee and meeting place work for you.</p>
                    <div class="row">
                      <button type="button" class="btn btn-signal" [disabled]="busy()" (click)="act('accept')">Accept terms</button>
                      <button type="button" class="btn" [disabled]="busy()" (click)="act('reject')">Reject</button>
                    </div>
                  } @else {
                    <h3>Waiting for {{ b.travelerName }}</h3>
                    <p>You can pay once they accept your proposed terms.</p>
                  }
                }
                @case ('Rejected') {
                  <h3>These terms were rejected</h3>
                  <p>Talk it over in chat. The sender can propose new terms.</p>
                }
                @case ('AwaitingPayment') {
                  @if (b.role === 'Sender') {
                    <h3>Pay {{ b.totalCents | usd }} to confirm</h3>
                    <p>Adyen holds your payment. The traveler gets the delivery fee only after the recipient shares the PIN.</p>
                    <button type="button" class="btn btn-signal" [disabled]="busy()" (click)="pay()">{{ busy() ? 'Opening checkout…' : 'Pay securely' }}</button>
                  } @else {
                    <h3>Waiting for payment</h3>
                    <p>Don't accept the item until the payment shows as held.</p>
                  }
                }
                @case ('Held') {
                  @if (b.role === 'Sender') {
                    <h3>Your handover code</h3>
                    <p>Bring the item unsealed. Show this code only after {{ b.travelerName }} has inspected it.</p>
                    <div class="ticket-code" aria-label="Handover code">
                      @for (c of b.handoverCode ?? ''; track $index) {
                        <span>{{ c }}</span>
                      }
                    </div>
                  } @else {
                    <h3>Inspect, then accept</h3>
                    <p>Check every item in person. If it's sealed, different from the listing or concerning, decline it.</p>
                    <form ngNativeValidate class="stack" (ngSubmit)="submitCode('handover')">
                      <label class="field">Sender's 6-digit code
                        <input class="code-input" name="code" inputmode="numeric" maxlength="6" required [(ngModel)]="code" />
                      </label>
                      <button type="submit" class="btn btn-signal" [disabled]="busy()">Accept the item</button>
                    </form>
                    <button type="button" class="btn" [disabled]="busy()" (click)="confirmAct('decline', 'Decline this item? The delivery is cancelled and the delivery fee goes back to the sender.')">Decline the item</button>
                  }
                }
                @case ('HandedOver') {
                  @if (b.role === 'Traveler') {
                    <h3>Enter the delivery PIN</h3>
                    <p>Meet {{ b.recipientName }}{{ b.pickupPlace ? ' at ' + b.pickupPlace : '' }}. They inspect the item, show ID, and then share their PIN.</p>
                    @if (b.recipientPhone; as phone) {
                      <div class="row">
                        <a class="btn btn-sm" [href]="'tel:' + digits(phone)">Call {{ phone }}</a>
                        <a class="btn btn-sm" [href]="'https://wa.me/' + digits(phone)" target="_blank" rel="noopener">WhatsApp</a>
                      </div>
                    }
                    <form ngNativeValidate class="stack" (ngSubmit)="submitCode('deliver')">
                      <label class="field">Recipient's PIN
                        <input class="code-input" name="pin" inputmode="numeric" maxlength="6" required [(ngModel)]="code" />
                      </label>
                      <button type="submit" class="btn btn-signal" [disabled]="busy()">Complete delivery</button>
                    </form>
                  } @else {
                    <h3>Your parcel is on its way</h3>
                    <p>{{ b.recipientName }} will share their PIN with {{ b.travelerName }} after inspecting the item.</p>
                  }
                }
                @case ('Delivered') {
                  <h3>Delivered</h3>
                  <p>{{ b.role === 'Traveler' ? (b.deliveryFeeCents | usd) + ' has moved to your wallet.' : 'The delivery is complete and the traveler has been paid.' }}</p>
                  @if (b.role === 'Traveler') {
                    <div><a class="btn btn-signal" routerLink="/wallet">Go to wallet</a></div>
                  }
                }
                @case ('Declined') {
                  <h3>The traveler declined this item</h3>
                  <p>The delivery fee goes back to the sender. The processing fee isn't refunded.</p>
                }
                @case ('Cancelled') {
                  <h3>Cancelled because of the flight</h3>
                  <p>The delivery fee goes back to the sender. The processing fee isn't refunded.</p>
                }
              }
            </section>

            @if (b.status === 'Held') {
              <section class="card row between">
                <div style="flex: 1; min-width: 220px">
                  <h3>Flight cancelled?</h3>
                  <p class="small muted">If you can't agree a new arrangement, cancel before handover to refund the delivery fee.</p>
                </div>
                <button type="button" class="btn btn-sm btn-danger" [disabled]="busy()" (click)="confirmAct('cancel-flight', 'Cancel this delivery because of the flight? The processing fee is not refunded.')">Cancel delivery</button>
              </section>
            }

            @if (b.canReview) {
              <form ngNativeValidate class="card stack" (ngSubmit)="submitReview()">
                <h3>Leave a review for {{ b.role === 'Sender' ? b.travelerName : b.senderName }}</h3>
                <div class="stars" role="radiogroup" aria-label="Rating">
                  @for (n of [1, 2, 3, 4, 5]; track n) {
                    <button type="button" role="radio" [attr.aria-checked]="rating() === n" [attr.aria-label]="n + ' stars'" [class.on]="n <= rating()" (click)="rating.set(n)">★</button>
                  }
                </div>
                <label class="field">Comment (optional)
                  <textarea name="comment" maxlength="1000" [(ngModel)]="comment"></textarea>
                </label>
                <div><button type="submit" class="btn btn-ink" [disabled]="busy() || !rating()">Submit review</button></div>
              </form>
            }
          </div>

          <aside class="stack">
            <section class="card stack">
              <h3>Delivery details</h3>
              <div class="kv">
                <div><span>Sender</span><b>{{ b.senderName }}</b></div>
                <div><span>Traveler</span><b>{{ b.travelerName }}</b></div>
                <div><span>Recipient</span><b>{{ b.recipientName }}</b></div>
                @if (b.recipientPhone) {
                  <div><span>Recipient's phone</span><b>{{ b.recipientPhone }}</b></div>
                }
                <div><span>Weight</span><b>{{ b.listing.weightKg }} kg</b></div>
                <div><span>Handover place</span><b>{{ b.meetingPlace }}</b></div>
                <div><span>Handover time</span><b>{{ b.meetingAt | date: 'd MMM y, h:mm a' }}</b></div>
                @if (b.pickupPlace) {
                  <div><span>Pickup place</span><b>{{ b.pickupPlace }}</b></div>
                }
              </div>
            </section>
            <section class="card stack">
              <h3>Payment</h3>
              <div class="kv">
                <div><span>Delivery fee</span><b>{{ b.deliveryFeeCents | usd }}</b></div>
                @if (b.role === 'Sender') {
                  <div><span>Processing fee</span><b>{{ b.processingFeeCents | usd }}</b></div>
                  <div><span>Total</span><b>{{ b.totalCents | usd }}</b></div>
                }
              </div>
            </section>
            @if (b.recipientLink) {
              <section class="card stack">
                <h3>Recipient's link</h3>
                <p class="small muted">Sent to {{ b.recipientName }}. You can also share it yourself.</p>
                <a class="small" style="overflow-wrap: anywhere" [href]="b.recipientLink" target="_blank" rel="noopener">{{ b.recipientLink }}</a>
              </section>
            }
          </aside>
        </div>
      } @else if (error()) {
        <div class="alert alert-error" role="alert">{{ error() }}</div>
      } @else {
        <div class="loading"></div>
      }
    </div>
  `,
})
export class BookingPage {
  private http = inject(HttpClient);

  readonly id = input.required<string>();
  protected readonly stages = STAGES;
  protected booking = signal<Booking | null>(null);
  protected stageIndex = computed(() => STAGES.findIndex((s) => s.status === this.booking()?.status));
  protected busy = signal(false);
  protected error = signal('');
  protected code = '';
  protected rating = signal(0);
  protected comment = '';

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private async load(id: string) {
    try {
      this.booking.set(await firstValueFrom(this.http.get<Booking>(`/api/bookings/${id}`)));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected digits(phone: string) {
    return phone.replace(/\D/g, '');
  }

  protected act(action: string, body: object = {}) {
    return this.run(async () => {
      this.booking.set(await firstValueFrom(this.http.post<Booking>(`/api/bookings/${this.id()}/${action}`, body)));
    });
  }

  protected confirmAct(action: string, question: string) {
    if (confirm(question)) this.act(action);
  }

  protected async submitCode(action: 'handover' | 'deliver') {
    await this.act(action, { code: this.code });
    if (!this.error()) this.code = '';
  }

  protected pay() {
    return this.run(async () => {
      const result = await firstValueFrom(this.http.post<{ checkoutUrl: string | null; simulated: boolean }>(`/api/bookings/${this.id()}/pay`, {}));
      if (result.checkoutUrl) {
        location.href = result.checkoutUrl;
      } else if (result.simulated) {
        this.booking.set(await firstValueFrom(this.http.post<Booking>(`/api/bookings/${this.id()}/simulate-payment`, {})));
      }
    });
  }

  protected submitReview() {
    return this.run(async () => {
      await firstValueFrom(this.http.post(`/api/bookings/${this.id()}/reviews`, { rating: this.rating(), comment: this.comment }));
      await this.load(this.id());
    });
  }

  private async run(action: () => Promise<void>) {
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
