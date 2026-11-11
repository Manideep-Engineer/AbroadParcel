import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { Injectable, Pipe, PipeTransform, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, tap } from 'rxjs';

export type ReviewStatus = 'NotSubmitted' | 'Pending' | 'Approved' | 'Rejected';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: 'User' | 'Admin';
  phoneVerified: boolean;
  idStatus: ReviewStatus;
  idRejectionReason: string | null;
  isVerified: boolean;
  walletBalanceCents: number;
}

export interface Person {
  id: string;
  fullName: string;
  isVerified: boolean;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  weightKg: number;
  originCity: string;
  originCountry: string;
  destinationCity: string;
  destinationCountry: string;
  status: string;
  sender: Person;
  photos: string[];
}

export interface Trip {
  id: string;
  fromAirport: string;
  fromCountry: string;
  toAirport: string;
  toCountry: string;
  flightDate: string;
  availableKg: number;
  flightStatus: ReviewStatus;
  rejectionReason: string | null;
  isClosed: boolean;
  traveler: Person;
}

export interface Booking {
  id: string;
  conversationId: string;
  status: string;
  role: 'Sender' | 'Traveler';
  deliveryFeeCents: number;
  processingFeeCents: number | null;
  totalCents: number | null;
  meetingPlace: string;
  meetingAt: string;
  pickupPlace: string;
  recipientName: string;
  recipientPhone: string | null;
  recipientLink: string | null;
  handoverCode: string | null;
  canReview: boolean;
  listing: { id: string; title: string; description: string; weightKg: number };
  trip: { id: string; fromAirport: string; toAirport: string; flightDate: string };
  senderName: string;
  travelerName: string;
}

export const COUNTRY_NAMES: Record<string, string> = { IN: 'India', US: 'USA', CA: 'Canada' };

export const LAUNCH_ROUTES = [
  { from: 'IN', to: 'US' },
  { from: 'US', to: 'IN' },
  { from: 'CA', to: 'US' },
  { from: 'US', to: 'CA' },
];

export const AIRPORTS: { code: string; city: string; country: string }[] = [
  { code: 'DEL', city: 'Delhi', country: 'IN' },
  { code: 'BOM', city: 'Mumbai', country: 'IN' },
  { code: 'HYD', city: 'Hyderabad', country: 'IN' },
  { code: 'BLR', city: 'Bengaluru', country: 'IN' },
  { code: 'MAA', city: 'Chennai', country: 'IN' },
  { code: 'AMD', city: 'Ahmedabad', country: 'IN' },
  { code: 'JFK', city: 'New York', country: 'US' },
  { code: 'EWR', city: 'Newark', country: 'US' },
  { code: 'ORD', city: 'Chicago', country: 'US' },
  { code: 'SFO', city: 'San Francisco', country: 'US' },
  { code: 'LAX', city: 'Los Angeles', country: 'US' },
  { code: 'IAD', city: 'Washington', country: 'US' },
  { code: 'DFW', city: 'Dallas', country: 'US' },
  { code: 'ATL', city: 'Atlanta', country: 'US' },
  { code: 'SEA', city: 'Seattle', country: 'US' },
  { code: 'BOS', city: 'Boston', country: 'US' },
  { code: 'YYZ', city: 'Toronto', country: 'CA' },
  { code: 'YVR', city: 'Vancouver', country: 'CA' },
  { code: 'YUL', city: 'Montreal', country: 'CA' },
  { code: 'YYC', city: 'Calgary', country: 'CA' },
];

export const BANNED_ITEMS = [
  'Illegal substances',
  'Prescription or unregulated medicines',
  'Weapons',
  'Hazardous materials',
  'Flammable items',
  'Loose lithium batteries',
  'Counterfeit goods',
  'Perishable foods',
  'Cash',
  'Gold and high-value jewellery',
  'Tobacco and vapes',
  'Alcohol',
  "Other people's passports and IDs",
];

const TOKEN_KEY = 'abroadparcel.token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);

  readonly token = signal<string | null>(readToken());
  readonly user = signal<User | null>(null);
  readonly isLoggedIn = computed(() => !!this.token());
  readonly isAdmin = computed(() => this.user()?.role === 'Admin');

  login(email: string, password: string) {
    return this.http.post<{ token: string; user: User }>('/api/auth/login', { email, password }).pipe(tap((r) => this.setSession(r)));
  }

  register(body: { fullName: string; email: string; phoneNumber: string; password: string }) {
    return this.http.post<{ token: string; user: User }>('/api/auth/register', body).pipe(tap((r) => this.setSession(r)));
  }

  async refresh(): Promise<void> {
    if (!this.token()) return;
    try {
      this.user.set(await firstValueFrom(this.http.get<User>('/api/auth/me')));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) this.logout();
    }
  }

  logout() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    this.token.set(null);
    this.user.set(null);
  }

  private setSession(session: { token: string; user: User }) {
    try {
      localStorage.setItem(TOKEN_KEY, session.token);
    } catch {}
    this.token.set(session.token);
    this.user.set(session.user);
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(Auth).token();
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { next: state.url } });
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!auth.user()) await auth.refresh();
  return auth.isAdmin() ? true : router.createUrlTree(['/']);
};

export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.error?.message) return error.error.message;
    const validation = error.error?.errors;
    if (validation) return (Object.values(validation) as string[][])[0]?.[0] ?? 'Please check the form.';
    if (error.status === 0) return "We can't reach the server. Please try again.";
  }
  return 'Something went wrong. Please try again.';
}

@Pipe({ name: 'usd' })
export class UsdPipe implements PipeTransform {
  transform(cents: number | null | undefined): string {
    if (cents == null) return '';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }
}

@Pipe({ name: 'country' })
export class CountryPipe implements PipeTransform {
  transform(code: string): string {
    return COUNTRY_NAMES[code] ?? code;
  }
}
