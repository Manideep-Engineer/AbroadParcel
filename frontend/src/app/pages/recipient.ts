import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/api';
import { StatusBadge } from './status-badge';

interface RecipientView {
  status: string;
  recipientName: string;
  travelerName: string;
  pickupPlace: string;
  fromAirport: string;
  toAirport: string;
  flightDate: string;
  title: string;
  description: string;
  photos: string[];
  deliveryPin: string | null;
}

@Component({
  selector: 'app-recipient',
  imports: [DatePipe, StatusBadge],
  template: `
    <div class="recipient">
      <div class="wrap">
        @if (view(); as v) {
          <div class="card stack">
            <div class="row between">
              <span class="eyebrow">Your delivery</span>
              <app-status [status]="v.status" />
            </div>
            <h1 style="font-size: 2rem">Hi {{ v.recipientName }}, {{ v.title }} is coming to you.</h1>
            @if (v.photos[0]; as photo) {
              <img [src]="photo" [alt]="v.title" style="width: 100%; max-height: 280px; object-fit: cover; border-radius: 12px" />
            }
            <p class="muted">{{ v.description }}</p>
            <div class="kv">
              <div><span>Traveler</span><b>{{ v.travelerName }}</b></div>
              <div><span>Flight</span><b class="mono">{{ v.fromAirport }} → {{ v.toAirport }}</b></div>
              <div><span>Flight date</span><b>{{ v.flightDate | date: 'd MMM y' : 'UTC' }}</b></div>
              @if (v.pickupPlace) {
                <div><span>Pickup place</span><b>{{ v.pickupPlace }}</b></div>
              }
            </div>

            @if (v.deliveryPin) {
              <div class="alert alert-warn"><b>Inspect the item and show your ID first.</b> Share this PIN with the traveler only when you're happy with what you received.</div>
              <div class="ticket-code" aria-label="Delivery PIN">
                @for (c of v.deliveryPin; track $index) {
                  <span>{{ c }}</span>
                }
              </div>
            } @else if (v.status === 'Delivered') {
              <div class="alert alert-ok">This delivery is complete. Thank you!</div>
            } @else if (v.status === 'Declined' || v.status === 'Cancelled') {
              <div class="alert alert-error">This delivery was cancelled. The sender has been told.</div>
            } @else {
              <div class="alert alert-warn">Your PIN appears here once the traveler has the item.</div>
            }
          </div>
        } @else if (error()) {
          <div class="card"><div class="alert alert-error" role="alert">{{ error() }}</div></div>
        } @else {
          <div class="card"><div class="loading"></div></div>
        }
      </div>
    </div>
  `,
})
export class Recipient {
  private http = inject(HttpClient);

  readonly token = input.required<string>();
  protected view = signal<RecipientView | null>(null);
  protected error = signal('');

  constructor() {
    effect(() => {
      const token = this.token();
      untracked(() => this.load(token));
    });
  }

  private async load(token: string) {
    try {
      this.view.set(await firstValueFrom(this.http.get<RecipientView>(`/api/recipient/${encodeURIComponent(token)}`)));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
