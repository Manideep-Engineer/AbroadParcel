import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth, UsdPipe, errorMessage } from '../core/api';
import { StatusBadge } from './status-badge';

interface WalletData {
  balanceCents: number;
  withdrawals: { id: string; amountCents: number; method: string; status: string; createdAt: string }[];
  earnings: { id: string; title: string; deliveryFeeCents: number; deliveredAt: string }[];
}

const METHOD_LABELS: Record<string, string> = { BankAccount: 'Bank account', DebitCard: 'Debit card', DigitalPayout: 'Digital payout' };

@Component({
  selector: 'app-wallet',
  imports: [FormsModule, RouterLink, DatePipe, UsdPipe, StatusBadge],
  template: `
    <div class="page wrap">
      <div class="page-head"><h1>Wallet</h1></div>
      @if (error()) {
        <div class="alert alert-error" role="alert" style="margin-bottom: 18px">{{ error() }}</div>
      }
      @if (data(); as d) {
        <div class="split">
          <div class="stack">
            <section class="stack">
              <h2 style="font-size: 1.4rem">Earnings</h2>
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th>Item</th><th>Delivered</th><th>Amount</th></tr></thead>
                  <tbody>
                    @for (e of d.earnings; track e.id) {
                      <tr>
                        <td><a [routerLink]="['/bookings', e.id]">{{ e.title }}</a></td>
                        <td>{{ e.deliveredAt | date: 'd MMM y' }}</td>
                        <td><b>{{ e.deliveryFeeCents | usd }}</b></td>
                      </tr>
                    } @empty {
                      <tr><td colspan="3" class="muted" style="padding: 26px; text-align: center">Delivery fees appear here after you enter the recipient's PIN.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
            <section class="stack">
              <h2 style="font-size: 1.4rem">Withdrawals</h2>
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th>Requested</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    @for (w of d.withdrawals; track w.id) {
                      <tr>
                        <td>{{ w.createdAt | date: 'd MMM y' }}</td>
                        <td>{{ methodLabels[w.method] }}</td>
                        <td><b>{{ w.amountCents | usd }}</b></td>
                        <td><app-status [status]="w.status" /></td>
                      </tr>
                    } @empty {
                      <tr><td colspan="4" class="muted" style="padding: 26px; text-align: center">No withdrawals yet.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <form ngNativeValidate class="card action-card stack" (ngSubmit)="withdraw()">
            <span class="eyebrow" style="color: var(--signal)">Available balance</span>
            <div style="font: 800 3.2rem/1 var(--display); color: var(--signal)">{{ d.balanceCents | usd }}</div>
            @if (success()) {
              <div class="alert alert-ok" role="status">{{ success() }}</div>
            }
            <label class="field">Amount (USD)
              <input name="amount" type="number" min="1" step="0.01" required [(ngModel)]="amount" />
            </label>
            <label class="field">Pay out to
              <select name="method" style="color: var(--ink)" [(ngModel)]="method">
                <option value="BankAccount">Bank account</option>
                <option value="DebitCard">Debit card</option>
                <option value="DigitalPayout">Digital payout</option>
              </select>
            </label>
            <button type="submit" class="btn btn-signal" [disabled]="busy() || !d.balanceCents">Request withdrawal</button>
          </form>
        </div>
      } @else if (!error()) {
        <div class="loading"></div>
      }
    </div>
  `,
})
export class Wallet {
  private http = inject(HttpClient);
  private auth = inject(Auth);

  protected readonly methodLabels = METHOD_LABELS;
  protected data = signal<WalletData | null>(null);
  protected amount: number | null = null;
  protected method = 'BankAccount';
  protected busy = signal(false);
  protected error = signal('');
  protected success = signal('');

  constructor() {
    this.load();
  }

  private async load() {
    try {
      this.data.set(await firstValueFrom(this.http.get<WalletData>('/api/wallet')));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected async withdraw() {
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await firstValueFrom(this.http.post('/api/wallet/withdraw', { amountCents: Math.round((this.amount ?? 0) * 100), method: this.method }));
      this.amount = null;
      this.success.set('Withdrawal requested.');
      await this.load();
      this.auth.refresh();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
