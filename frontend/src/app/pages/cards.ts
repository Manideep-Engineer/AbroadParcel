import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { CountryPipe, Listing, Trip } from '../core/api';

@Component({
  selector: 'app-trip-card',
  imports: [DatePipe, DecimalPipe, CountryPipe],
  template: `
    <article class="pass">
      <div class="pass-main">
        <div class="pass-top">
          <span class="eyebrow">Boarding pass</span>
          <ng-content select="[badge]" />
        </div>
        <div class="pass-route">
          <span>{{ trip().fromAirport }}</span>
          <svg viewBox="0 0 100 20" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M0 10H100" stroke="currentColor" stroke-width="2" stroke-dasharray="5 5" vector-effect="non-scaling-stroke" /></svg>
          <span>{{ trip().toAirport }}</span>
        </div>
        <div class="pass-meta">
          <div><small>Route</small>{{ trip().fromCountry | country }} → {{ trip().toCountry | country }}</div>
          <div><small>Flight date</small>{{ trip().flightDate | date: 'd MMM y' : 'UTC' }}</div>
          <div><small>Traveler</small>{{ trip().traveler.fullName }}</div>
        </div>
      </div>
      <div class="pass-stub">
        <div class="pass-kg">{{ trip().availableKg | number: '1.0-1' }}<small>KG SPACE</small></div>
        <ng-content />
      </div>
    </article>
  `,
})
export class TripCard {
  readonly trip = input.required<Trip>();
}

@Component({
  selector: 'app-listing-card',
  imports: [DecimalPipe],
  template: `
    <article class="tag">
      <div class="tag-photo">
        @if (listing().photos[0]; as photo) {
          <img [src]="photo" [alt]="listing().title" loading="lazy" />
        }
        <span class="tag-weight">{{ listing().weightKg | number: '1.0-2' }} kg</span>
      </div>
      <div class="tag-body">
        <span class="tag-route">{{ listing().originCity }} → {{ listing().destinationCity }}</span>
        <h3>{{ listing().title }}</h3>
        <p>{{ listing().description }}</p>
        <div class="tag-foot">
          <span class="small muted">{{ listing().sender.fullName }}</span>
          <ng-content />
        </div>
      </div>
    </article>
  `,
})
export class ListingCard {
  readonly listing = input.required<Listing>();
}
