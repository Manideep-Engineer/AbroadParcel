import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AIRPORTS, Auth, errorMessage } from '../core/api';

const REACHABLE: Record<string, string[]> = { IN: ['US'], US: ['IN', 'CA'], CA: ['US'] };

@Component({
  selector: 'app-new-trip',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page wrap" style="max-width: 780px">
      <div class="page-head">
        <div>
          <h1>List a trip</h1>
          <p class="lead">Your trip goes live once your flight booking is approved.</p>
        </div>
      </div>

      @if (auth.user() && !auth.user()!.isVerified) {
        <div class="alert alert-warn row between" style="margin-bottom: 20px">
          <span>You need to be verified before you can list a trip.</span>
          <a class="btn btn-sm" routerLink="/verify">Get verified</a>
        </div>
      }

      <form ngNativeValidate class="card form-grid" (ngSubmit)="submit()">
        @if (error()) {
          <div class="alert alert-error full" role="alert">{{ error() }}</div>
        }
        <label class="field">Departure airport
          <select name="from" [ngModel]="from()" (ngModelChange)="setFrom($event)" required>
            @for (a of airports; track a.code) {
              <option [value]="a.code">{{ a.code }} · {{ a.city }}</option>
            }
          </select>
        </label>
        <label class="field">Arrival airport
          <select name="to" [ngModel]="to()" (ngModelChange)="to.set($event)" required>
            @for (a of arrivals(); track a.code) {
              <option [value]="a.code">{{ a.code }} · {{ a.city }}</option>
            }
          </select>
        </label>
        <label class="field">Flight date
          <input name="flightDate" type="date" [min]="today" [(ngModel)]="flightDate" required />
        </label>
        <label class="field">Space you can carry (kg)
          <input name="availableKg" type="number" min="0.1" max="100" step="0.1" [(ngModel)]="availableKg" required />
        </label>
        <label class="field full">Flight booking
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" (change)="pickDocument($event)" required />
          <span class="hint">A screenshot or PDF of your booking. Only the admin can view it.</span>
        </label>
        <div class="full">
          <button class="btn btn-signal btn-block" type="submit" [disabled]="busy()">{{ busy() ? 'Submitting…' : 'Submit trip' }}</button>
        </div>
      </form>
    </div>
  `,
})
export class NewTrip {
  private http = inject(HttpClient);
  private router = inject(Router);
  protected auth = inject(Auth);

  protected readonly airports = AIRPORTS;
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected from = signal('DEL');
  protected to = signal('JFK');
  protected arrivals = computed(() => AIRPORTS.filter((a) => REACHABLE[country(this.from())].includes(a.country)));
  protected flightDate = '';
  protected availableKg: number | null = null;
  protected document = signal<File | null>(null);
  protected busy = signal(false);
  protected error = signal('');

  protected setFrom(code: string) {
    this.from.set(code);
    if (!this.arrivals().some((a) => a.code === this.to())) this.to.set(this.arrivals()[0].code);
  }

  protected pickDocument(event: Event) {
    this.document.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected async submit() {
    const file = this.document();
    if (!file) {
      this.error.set('Upload your flight booking.');
      return;
    }
    const form = new FormData();
    form.append('fromAirport', this.from());
    form.append('fromCountry', country(this.from()));
    form.append('toAirport', this.to());
    form.append('toCountry', country(this.to()));
    form.append('flightDate', this.flightDate);
    form.append('availableKg', String(this.availableKg ?? 0));
    form.append('bookingDocument', file);

    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.http.post('/api/trips', form));
      this.router.navigateByUrl('/dashboard');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}

function country(code: string): string {
  return AIRPORTS.find((a) => a.code === code)!.country;
}
