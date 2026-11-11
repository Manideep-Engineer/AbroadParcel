import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth, CountryPipe, LAUNCH_ROUTES, Listing, Trip, errorMessage } from '../core/api';
import { ListingCard, TripCard } from './cards';

type Tab = 'trips' | 'parcels';

@Component({
  selector: 'app-browse',
  imports: [RouterLink, TripCard, ListingCard, CountryPipe],
  template: `
    <div class="page wrap">
      <div class="page-head">
        <div>
          <h1>Who's flying where</h1>
          <p class="lead">Browse for free. Chat with a verified member once you've found a match.</p>
        </div>
        <div class="tabs" role="tablist">
          <button type="button" role="tab" [attr.aria-selected]="tab() === 'trips'" [class.on]="tab() === 'trips'" (click)="tab.set('trips')">Trips</button>
          <button type="button" role="tab" [attr.aria-selected]="tab() === 'parcels'" [class.on]="tab() === 'parcels'" (click)="tab.set('parcels')">Parcels</button>
        </div>
      </div>

      <div class="filters">
        <div class="route-pills">
          <button type="button" [class.on]="!route()" (click)="setRoute(null)">ALL ROUTES</button>
          @for (r of routes; track r.from + r.to) {
            <button type="button" [class.on]="route() === r" (click)="setRoute(r)">{{ r.from | country }} → {{ r.to | country }}</button>
          }
        </div>
      </div>

      @if (error()) {
        <div class="alert alert-error" role="alert" style="margin-bottom: 20px">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="grid-2"><div class="loading"></div><div class="loading"></div><div class="loading"></div></div>
      } @else if (tab() === 'trips') {
        <div class="grid-2">
          @for (trip of trips(); track trip.id) {
            <app-trip-card [trip]="trip">
              <button type="button" class="btn btn-sm btn-signal btn-on-dark" (click)="contactTrip(trip)">Chat</button>
            </app-trip-card>
          } @empty {
            <div class="empty full">
              <h3>No trips on this route yet</h3>
              <p>List your parcel so travelers on this route can find you.</p>
              <a class="btn btn-signal" routerLink="/parcels/new">List a parcel</a>
            </div>
          }
        </div>
      } @else {
        <div class="grid-2">
          @for (listing of listings(); track listing.id) {
            <app-listing-card [listing]="listing">
              <button type="button" class="btn btn-sm btn-signal" (click)="contactListing(listing)">Chat</button>
            </app-listing-card>
          } @empty {
            <div class="empty full">
              <h3>No parcels on this route yet</h3>
              <p>List your trip so senders on this route can find you.</p>
              <a class="btn btn-signal" routerLink="/trips/new">List a trip</a>
            </div>
          }
        </div>
      }
    </div>

    @if (picker(); as p) {
      <div class="overlay" (click)="picker.set(null)">
        <div class="dialog stack" role="dialog" aria-modal="true" aria-label="Choose what to chat about" (click)="$event.stopPropagation()">
          <h3>{{ p.title }}</h3>
          @for (option of p.options; track option.id) {
            <button type="button" class="choice" [disabled]="starting()" (click)="p.choose(option.id)">
              <span>{{ option.label }}</span><span aria-hidden="true">→</span>
            </button>
          } @empty {
            <p class="muted">{{ p.emptyText }}</p>
            <a class="btn btn-signal" [routerLink]="p.emptyLink">{{ p.emptyAction }}</a>
          }
          <button type="button" class="btn btn-sm" (click)="picker.set(null)">Close</button>
        </div>
      </div>
    }
  `,
})
export class Browse {
  private http = inject(HttpClient);
  private auth = inject(Auth);
  private router = inject(Router);

  protected readonly routes = LAUNCH_ROUTES;
  protected tab = signal<Tab>('trips');
  protected route = signal<(typeof LAUNCH_ROUTES)[number] | null>(null);
  protected trips = signal<Trip[]>([]);
  protected listings = signal<Listing[]>([]);
  private pendingLoads = signal(0);
  protected loading = computed(() => this.pendingLoads() > 0);
  protected starting = signal(false);
  protected error = signal('');
  protected picker = signal<{
    title: string;
    options: { id: string; label: string }[];
    choose: (id: string) => void;
    emptyText: string;
    emptyAction: string;
    emptyLink: string;
  } | null>(null);

  constructor() {
    this.load();
  }

  protected setRoute(route: (typeof LAUNCH_ROUTES)[number] | null) {
    this.route.set(route);
    this.load();
  }

  private async load() {
    const r = this.route();
    const params = r ? `?from=${r.from}&to=${r.to}` : '';
    this.pendingLoads.update((n) => n + 1);
    this.error.set('');
    try {
      const [trips, listings] = await Promise.all([
        firstValueFrom(this.http.get<Trip[]>(`/api/trips${params}`)),
        firstValueFrom(this.http.get<Listing[]>(`/api/listings${params}`)),
      ]);
      this.trips.set(trips);
      this.listings.set(listings);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.pendingLoads.update((n) => n - 1);
    }
  }

  /** The sender picks which of their own parcels this chat is about. */
  protected async contactTrip(trip: Trip) {
    if (!this.ensureLoggedIn()) return;
    try {
      const mine = await firstValueFrom(this.http.get<Listing[]>('/api/listings/mine'));
      const options = mine
        .filter((l) => l.status === 'Open' && l.originCountry === trip.fromCountry && l.destinationCountry === trip.toCountry && l.weightKg <= trip.availableKg)
        .map((l) => ({ id: l.id, label: `${l.title} · ${l.weightKg} kg` }));
      this.picker.set({
        title: `Which parcel for ${trip.fromAirport} → ${trip.toAirport}?`,
        options,
        choose: (id) => this.start(id, trip.id),
        emptyText: "You don't have an open parcel that fits this trip.",
        emptyAction: 'List a parcel',
        emptyLink: '/parcels/new',
      });
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  /** The traveler picks which of their own trips can carry this parcel. */
  protected async contactListing(listing: Listing) {
    if (!this.ensureLoggedIn()) return;
    try {
      const mine = await firstValueFrom(this.http.get<Trip[]>('/api/trips/mine'));
      const options = mine
        .filter((t) => !t.isClosed && t.flightStatus === 'Approved' && t.fromCountry === listing.originCountry && t.toCountry === listing.destinationCountry && t.availableKg >= listing.weightKg)
        .map((t) => ({ id: t.id, label: `${t.fromAirport} → ${t.toAirport} · ${t.flightDate}` }));
      this.picker.set({
        title: `Which trip can carry "${listing.title}"?`,
        options,
        choose: (id) => this.start(listing.id, id),
        emptyText: "You don't have an approved trip that fits this parcel.",
        emptyAction: 'List a trip',
        emptyLink: '/trips/new',
      });
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  private ensureLoggedIn(): boolean {
    if (this.auth.isLoggedIn()) return true;
    this.router.navigate(['/login'], { queryParams: { next: '/browse' } });
    return false;
  }

  private async start(listingId: string, tripId: string) {
    this.starting.set(true);
    try {
      const { id } = await firstValueFrom(this.http.post<{ id: string }>('/api/conversations', { listingId, tripId }));
      this.router.navigate(['/chat', id]);
    } catch (e) {
      this.picker.set(null);
      this.error.set(errorMessage(e));
    } finally {
      this.starting.set(false);
    }
  }
}
