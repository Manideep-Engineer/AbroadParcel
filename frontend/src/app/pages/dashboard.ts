import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth, Booking, Listing, Trip, UsdPipe, errorMessage } from '../core/api';
import { ListingCard, TripCard } from './cards';
import { StatusBadge } from './status-badge';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, UsdPipe, TripCard, ListingCard, StatusBadge],
  template: `
    <div class="page wrap">
      <div class="page-head">
        <div>
          <span class="eyebrow">Dashboard</span>
          <h1 style="margin-top: 10px">Hello, {{ firstName() }}.</h1>
        </div>
        <div class="row">
          <a class="btn btn-signal" routerLink="/parcels/new">List a parcel</a>
          <a class="btn" routerLink="/trips/new">List a trip</a>
        </div>
      </div>

      @if (auth.user(); as user) {
        @if (!user.isVerified) {
          <div class="alert alert-warn row between" style="margin-bottom: 24px">
            <span>Verify your phone and ID to list items and chat.</span>
            <a class="btn btn-sm" routerLink="/verify">Get verified</a>
          </div>
        }
      }

      @if (error()) {
        <div class="alert alert-error" role="alert" style="margin-bottom: 24px">{{ error() }}</div>
      }

      <section class="stack" style="margin-bottom: 48px">
        <h2 style="font-size: 1.6rem">Deliveries</h2>
        @if (loading()) {
          <div class="loading"></div>
        } @else {
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Item</th><th>Route</th><th>Flight</th><th>You are</th><th>Fee</th><th>Status</th><th></th></tr></thead>
              <tbody>
                @for (b of bookings(); track b.id) {
                  <tr>
                    <td><b>{{ b.listing.title }}</b></td>
                    <td class="mono">{{ b.trip.fromAirport }} → {{ b.trip.toAirport }}</td>
                    <td>{{ b.trip.flightDate | date: 'd MMM y' : 'UTC' }}</td>
                    <td>{{ b.role }}</td>
                    <td>{{ b.deliveryFeeCents | usd }}</td>
                    <td><app-status [status]="b.status" /></td>
                    <td><a class="btn btn-sm" [routerLink]="['/bookings', b.id]">Open</a></td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="muted" style="padding: 30px; text-align: center">No deliveries yet. They'll appear here once terms are proposed in chat.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <section class="stack" style="margin-bottom: 48px">
        <h2 style="font-size: 1.6rem">Your trips</h2>
        <div class="grid-2">
          @for (trip of trips(); track trip.id) {
            <app-trip-card [trip]="trip">
              <span badge><app-status [status]="trip.isClosed ? 'Closed' : trip.flightStatus" /></span>
              @if (!trip.isClosed) {
                <button type="button" class="btn btn-sm btn-on-dark" (click)="closeTrip(trip)">Close</button>
              }
            </app-trip-card>
          } @empty {
            @if (!loading()) {
              <div class="empty full"><h3>No trips yet</h3><p>Flying soon? List your spare luggage space.</p></div>
            }
          }
        </div>
      </section>

      <section class="stack">
        <h2 style="font-size: 1.6rem">Your parcels</h2>
        <div class="grid-2">
          @for (listing of listings(); track listing.id) {
            <app-listing-card [listing]="listing">
              <span class="row">
                <app-status [status]="listing.status" />
                @if (listing.status === 'Open') {
                  <button type="button" class="btn btn-sm" (click)="closeListing(listing)">Close</button>
                }
              </span>
            </app-listing-card>
          } @empty {
            @if (!loading()) {
              <div class="empty full"><h3>No parcels yet</h3><p>Got something to send? List it in a couple of minutes.</p></div>
            }
          }
        </div>
      </section>
    </div>
  `,
})
export class Dashboard {
  private http = inject(HttpClient);
  protected auth = inject(Auth);

  protected firstName = computed(() => this.auth.user()?.fullName.split(' ')[0] ?? 'there');
  protected bookings = signal<Booking[]>([]);
  protected trips = signal<Trip[]>([]);
  protected listings = signal<Listing[]>([]);
  protected loading = signal(true);
  protected error = signal('');

  constructor() {
    this.load();
  }

  private async load() {
    try {
      const [bookings, trips, listings] = await Promise.all([
        firstValueFrom(this.http.get<Booking[]>('/api/bookings')),
        firstValueFrom(this.http.get<Trip[]>('/api/trips/mine')),
        firstValueFrom(this.http.get<Listing[]>('/api/listings/mine')),
      ]);
      this.bookings.set(bookings);
      this.trips.set(trips);
      this.listings.set(listings);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected closeTrip(trip: Trip) {
    this.close(`/api/trips/${trip.id}/close`);
  }

  protected closeListing(listing: Listing) {
    this.close(`/api/listings/${listing.id}/close`);
  }

  private async close(url: string) {
    this.error.set('');
    try {
      await firstValueFrom(this.http.post(url, {}));
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
