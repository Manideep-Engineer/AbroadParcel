import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth, BANNED_ITEMS, COUNTRY_NAMES, errorMessage } from '../core/api';

const DESTINATIONS: Record<string, string[]> = { IN: ['US'], US: ['IN', 'CA'], CA: ['US'] };

@Component({
  selector: 'app-new-listing',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page wrap" style="max-width: 780px">
      <div class="page-head">
        <div>
          <h1>List a parcel</h1>
          <p class="lead">Describe it honestly: the traveler checks it against this listing at handover.</p>
        </div>
      </div>

      @if (auth.user() && !auth.user()!.isVerified) {
        <div class="alert alert-warn row between" style="margin-bottom: 20px">
          <span>You need to be verified before you can list a parcel.</span>
          <a class="btn btn-sm" routerLink="/verify">Get verified</a>
        </div>
      }

      <form ngNativeValidate class="card form-grid" (ngSubmit)="submit()">
        @if (error()) {
          <div class="alert alert-error full" role="alert">{{ error() }}</div>
        }
        <label class="field full">What are you sending?
          <input name="title" [(ngModel)]="title" required maxlength="120" placeholder="Unsealed family documents" />
        </label>
        <label class="field full">Description
          <textarea name="description" [(ngModel)]="description" required maxlength="2000" placeholder="What's in it, how big it is, and anything the traveler should know."></textarea>
        </label>
        <label class="field">From country
          <select name="originCountry" [ngModel]="originCountry()" (ngModelChange)="setOrigin($event)" required>
            @for (code of origins; track code) {
              <option [value]="code">{{ countryNames[code] }}</option>
            }
          </select>
        </label>
        <label class="field">From city
          <input name="originCity" [(ngModel)]="originCity" required maxlength="80" />
        </label>
        <label class="field">To country
          <select name="destinationCountry" [ngModel]="destinationCountry()" (ngModelChange)="destinationCountry.set($event)" required>
            @for (code of destinations(); track code) {
              <option [value]="code">{{ countryNames[code] }}</option>
            }
          </select>
        </label>
        <label class="field">To city
          <input name="destinationCity" [(ngModel)]="destinationCity" required maxlength="80" />
        </label>
        <label class="field">Approximate weight (kg)
          <input name="weightKg" type="number" min="0.01" max="100" step="0.01" [(ngModel)]="weightKg" required />
        </label>
        <label class="field">Photos (1 to 5)
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple (change)="pickPhotos($event)" />
          <span class="hint">{{ photos().length ? photos().length + ' selected' : 'JPG, PNG or WebP, up to 8 MB each.' }}</span>
        </label>

        <div class="full alert alert-warn small">
          <b>Never allowed:</b> {{ banned }}.
        </div>
        <label class="check full">
          <input type="checkbox" name="accepts" [(ngModel)]="acceptsRules" required />
          <span>This item will be unsealed for inspection, including any documents, and isn't on the banned list.</span>
        </label>
        <div class="full">
          <button class="btn btn-signal btn-block" type="submit" [disabled]="busy() || !acceptsRules">{{ busy() ? 'Publishing…' : 'Publish parcel' }}</button>
        </div>
      </form>
    </div>
  `,
})
export class NewListing {
  private http = inject(HttpClient);
  private router = inject(Router);
  protected auth = inject(Auth);

  protected readonly countryNames = COUNTRY_NAMES;
  protected readonly origins = Object.keys(DESTINATIONS);
  protected readonly banned = BANNED_ITEMS.join(', ');

  protected title = '';
  protected description = '';
  protected originCity = '';
  protected destinationCity = '';
  protected weightKg: number | null = null;
  protected acceptsRules = false;
  protected originCountry = signal('IN');
  protected destinationCountry = signal('US');
  protected destinations = computed(() => DESTINATIONS[this.originCountry()]);
  protected photos = signal<File[]>([]);
  protected busy = signal(false);
  protected error = signal('');

  protected setOrigin(code: string) {
    this.originCountry.set(code);
    this.destinationCountry.set(DESTINATIONS[code][0]);
  }

  protected pickPhotos(event: Event) {
    this.photos.set(Array.from((event.target as HTMLInputElement).files ?? []));
  }

  protected async submit() {
    if (this.photos().length < 1 || this.photos().length > 5) {
      this.error.set('Add between 1 and 5 photos.');
      return;
    }
    const form = new FormData();
    form.append('title', this.title);
    form.append('description', this.description);
    form.append('originCity', this.originCity);
    form.append('originCountry', this.originCountry());
    form.append('destinationCity', this.destinationCity);
    form.append('destinationCountry', this.destinationCountry());
    form.append('weightKg', String(this.weightKg ?? 0));
    form.append('acceptsItemRules', String(this.acceptsRules));
    this.photos().forEach((photo) => form.append('photos', photo));

    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.http.post('/api/listings', form));
      this.router.navigateByUrl('/dashboard');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
