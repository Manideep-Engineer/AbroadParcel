import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UsdPipe, errorMessage } from '../core/api';
import { StatusBadge } from './status-badge';

type Section = 'users' | 'trips' | 'listings' | 'bookings' | 'withdrawals';

@Component({
  selector: 'app-admin',
  imports: [DatePipe, UsdPipe, StatusBadge],
  template: `
    <div class="page wrap">
      <div class="page-head">
        <div>
          <span class="eyebrow">Admin</span>
          <h1 style="margin-top: 10px">Control tower</h1>
        </div>
      </div>

      @if (overview(); as o) {
        <div class="stats">
          <div class="stat"><b>{{ o.users }}</b><span>Members</span></div>
          <div class="stat"><b>{{ o.pendingIds }}</b><span>IDs to review</span></div>
          <div class="stat"><b>{{ o.pendingFlights }}</b><span>Flights to review</span></div>
          <div class="stat"><b>{{ o.activeBookings }}</b><span>Active deliveries</span></div>
          <div class="stat"><b>{{ o.requestedWithdrawals }}</b><span>Withdrawals to pay</span></div>
        </div>
      }

      @if (error()) {
        <div class="alert alert-error" role="alert" style="margin-bottom: 18px">{{ error() }}</div>
      }

      <div class="tabs" style="margin-bottom: 20px">
        @for (s of sections; track s.key) {
          <button type="button" [class.on]="section() === s.key" (click)="open(s.key)">{{ s.label }}</button>
        }
      </div>

      <div class="table-wrap">
        @switch (section()) {
          @case ('users') {
            <table class="table">
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Phone check</th><th>ID</th><th>Wallet</th><th>Joined</th><th></th></tr></thead>
              <tbody>
                @for (u of rows(); track u.id) {
                  <tr>
                    <td><b>{{ u.fullName }}</b></td>
                    <td>{{ u.email }}</td>
                    <td>{{ u.phoneNumber }}</td>
                    <td><span class="badge" [class.badge-ok]="u.phoneVerified" [class.badge-quiet]="!u.phoneVerified">{{ u.phoneVerified ? 'Verified' : 'No' }}</span></td>
                    <td><app-status [status]="u.idStatus" /></td>
                    <td>{{ u.walletBalanceCents | usd }}</td>
                    <td>{{ u.createdAt | date: 'd MMM y' }}</td>
                    <td>
                      <div class="row" style="flex-wrap: nowrap">
                        @if (u.hasIdDocument) {
                          <button type="button" class="btn btn-sm" (click)="viewFile('/api/admin/users/' + u.id + '/id-document')">View ID</button>
                        }
                        @if (u.idStatus === 'Pending') {
                          <button type="button" class="btn btn-sm btn-signal" (click)="review('/api/admin/users/' + u.id + '/id-review', true)">Approve</button>
                          <button type="button" class="btn btn-sm btn-danger" (click)="review('/api/admin/users/' + u.id + '/id-review', false)">Reject</button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
          @case ('trips') {
            <table class="table">
              <thead><tr><th>Route</th><th>Flight date</th><th>Space</th><th>Traveler</th><th>Booking</th><th></th></tr></thead>
              <tbody>
                @for (t of rows(); track t.id) {
                  <tr>
                    <td class="mono"><b>{{ t.fromAirport }} → {{ t.toAirport }}</b></td>
                    <td>{{ t.flightDate | date: 'd MMM y' : 'UTC' }}</td>
                    <td>{{ t.availableKg }} kg</td>
                    <td>{{ t.travelerName }}<br /><span class="small muted">{{ t.travelerEmail }}</span></td>
                    <td><app-status [status]="t.flightStatus" /></td>
                    <td>
                      <div class="row" style="flex-wrap: nowrap">
                        <button type="button" class="btn btn-sm" (click)="viewFile('/api/admin/trips/' + t.id + '/booking-document')">View booking</button>
                        @if (t.flightStatus === 'Pending') {
                          <button type="button" class="btn btn-sm btn-signal" (click)="review('/api/admin/trips/' + t.id + '/flight-review', true)">Approve</button>
                          <button type="button" class="btn btn-sm btn-danger" (click)="review('/api/admin/trips/' + t.id + '/flight-review', false)">Reject</button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
          @case ('listings') {
            <table class="table">
              <thead><tr><th>Item</th><th>Route</th><th>Weight</th><th>Sender</th><th>Status</th></tr></thead>
              <tbody>
                @for (l of rows(); track l.id) {
                  <tr>
                    <td><b>{{ l.title }}</b></td>
                    <td>{{ l.originCity }}, {{ l.originCountry }} → {{ l.destinationCity }}, {{ l.destinationCountry }}</td>
                    <td>{{ l.weightKg }} kg</td>
                    <td>{{ l.senderName }}<br /><span class="small muted">{{ l.senderEmail }}</span></td>
                    <td><app-status [status]="l.status" /></td>
                  </tr>
                }
              </tbody>
            </table>
          }
          @case ('bookings') {
            <table class="table">
              <thead><tr><th>Item</th><th>Sender</th><th>Traveler</th><th>Recipient</th><th>Handover place</th><th>Pickup place</th><th>Fees</th><th>Status</th><th></th></tr></thead>
              <tbody>
                @for (b of rows(); track b.id) {
                  <tr>
                    <td><b>{{ b.listingTitle }}</b></td>
                    <td>{{ b.senderName }}</td>
                    <td>{{ b.travelerName }}</td>
                    <td>{{ b.recipientName }}<br /><span class="small muted">{{ b.recipientPhone }}</span></td>
                    <td>{{ b.meetingPlace }}</td>
                    <td>{{ b.pickupPlace }}</td>
                    <td>{{ b.deliveryFeeCents | usd }} + {{ b.processingFeeCents | usd }}</td>
                    <td><app-status [status]="b.status" /></td>
                    <td><button type="button" class="btn btn-sm" (click)="viewChat(b.conversationId)">Read chat</button></td>
                  </tr>
                }
              </tbody>
            </table>
          }
          @case ('withdrawals') {
            <table class="table">
              <thead><tr><th>Member</th><th>Amount</th><th>Method</th><th>Requested</th><th>Status</th><th></th></tr></thead>
              <tbody>
                @for (w of rows(); track w.id) {
                  <tr>
                    <td>{{ w.userName }}<br /><span class="small muted">{{ w.userEmail }}</span></td>
                    <td><b>{{ w.amountCents | usd }}</b></td>
                    <td>{{ w.method }}</td>
                    <td>{{ w.createdAt | date: 'd MMM y' }}</td>
                    <td><app-status [status]="w.status" /></td>
                    <td>
                      @if (w.status === 'Requested') {
                        <button type="button" class="btn btn-sm btn-signal" (click)="markPaid(w.id)">Mark paid</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        }
        @if (!rows().length) {
          <p class="muted" style="padding: 30px; text-align: center">Nothing here yet.</p>
        }
      </div>
    </div>

    @if (chat(); as messages) {
      <div class="overlay" (click)="chat.set(null)">
        <div class="dialog stack" role="dialog" aria-modal="true" aria-label="Chat history" (click)="$event.stopPropagation()">
          <h3>Chat history</h3>
          @for (m of messages; track m.id) {
            <div>
              <b class="small">{{ m.senderName }}</b> <span class="small muted">{{ m.sentAt | date: 'd MMM, h:mm a' }}</span>
              <p style="overflow-wrap: anywhere">{{ m.body }}</p>
            </div>
          } @empty {
            <p class="muted">No messages in this chat.</p>
          }
          <button type="button" class="btn btn-sm" (click)="chat.set(null)">Close</button>
        </div>
      </div>
    }
  `,
})
export class Admin {
  private http = inject(HttpClient);

  protected readonly sections: { key: Section; label: string }[] = [
    { key: 'users', label: 'Members' },
    { key: 'trips', label: 'Trips' },
    { key: 'listings', label: 'Parcels' },
    { key: 'bookings', label: 'Deliveries' },
    { key: 'withdrawals', label: 'Withdrawals' },
  ];
  protected section = signal<Section>('users');
  // Each section renders different admin-only columns from the API, so rows stay untyped here.
  protected rows = signal<any[]>([]);
  protected overview = signal<any>(null);
  protected chat = signal<any[] | null>(null);
  protected error = signal('');

  constructor() {
    this.refresh();
  }

  protected open(section: Section) {
    this.section.set(section);
    this.rows.set([]);
    this.refresh();
  }

  private async refresh() {
    this.error.set('');
    try {
      const section = this.section();
      const [overview, rows] = await Promise.all([
        firstValueFrom(this.http.get('/api/admin/overview')),
        firstValueFrom(this.http.get<any[]>(`/api/admin/${section}`)),
      ]);
      this.overview.set(overview);
      if (section === this.section()) this.rows.set(rows);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected async review(url: string, approve: boolean) {
    let reason: string | null = null;
    if (!approve) {
      reason = prompt('Reason for rejecting (shown to the member):');
      if (reason === null) return;
    }
    await this.post(url, { approve, reason });
  }

  protected markPaid(id: string) {
    return this.post(`/api/admin/withdrawals/${id}/mark-paid`, {});
  }

  private async post(url: string, body: object) {
    try {
      await firstValueFrom(this.http.post(url, body));
      await this.refresh();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected async viewChat(conversationId: string) {
    try {
      this.chat.set(await firstValueFrom(this.http.get<any[]>(`/api/admin/conversations/${conversationId}`)));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  /** Private files need the auth header, so they're fetched first and then opened as a blob. */
  protected async viewFile(url: string) {
    try {
      const blob = await firstValueFrom(this.http.get(url, { responseType: 'blob' }));
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
