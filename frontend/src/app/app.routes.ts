import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/api';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home').then((m) => m.Home), title: 'AbroadParcel — Send parcels with travelers already flying' },
  { path: 'browse', loadComponent: () => import('./pages/browse').then((m) => m.Browse), title: 'Browse trips and parcels — AbroadParcel' },
  { path: 'login', loadComponent: () => import('./pages/auth-page').then((m) => m.AuthPage), data: { mode: 'login' }, title: 'Log in — AbroadParcel' },
  { path: 'register', loadComponent: () => import('./pages/auth-page').then((m) => m.AuthPage), data: { mode: 'register' }, title: 'Create an account — AbroadParcel' },
  { path: 'dashboard', canActivate: [authGuard], loadComponent: () => import('./pages/dashboard').then((m) => m.Dashboard), title: 'Dashboard — AbroadParcel' },
  { path: 'verify', canActivate: [authGuard], loadComponent: () => import('./pages/verify').then((m) => m.Verify), title: 'Verify your account — AbroadParcel' },
  { path: 'parcels/new', canActivate: [authGuard], loadComponent: () => import('./pages/new-listing').then((m) => m.NewListing), title: 'List a parcel — AbroadParcel' },
  { path: 'trips/new', canActivate: [authGuard], loadComponent: () => import('./pages/new-trip').then((m) => m.NewTrip), title: 'List a trip — AbroadParcel' },
  { path: 'chat', canActivate: [authGuard], loadComponent: () => import('./pages/chat').then((m) => m.Chat), title: 'Messages — AbroadParcel' },
  { path: 'chat/:id', canActivate: [authGuard], loadComponent: () => import('./pages/chat').then((m) => m.Chat), title: 'Messages — AbroadParcel' },
  { path: 'bookings/:id', canActivate: [authGuard], loadComponent: () => import('./pages/booking').then((m) => m.BookingPage), title: 'Delivery — AbroadParcel' },
  { path: 'wallet', canActivate: [authGuard], loadComponent: () => import('./pages/wallet').then((m) => m.Wallet), title: 'Wallet — AbroadParcel' },
  { path: 'admin', canActivate: [adminGuard], loadComponent: () => import('./pages/admin').then((m) => m.Admin), title: 'Admin — AbroadParcel' },
  { path: 'r/:token', loadComponent: () => import('./pages/recipient').then((m) => m.Recipient), title: 'Your delivery — AbroadParcel' },
  { path: '**', redirectTo: '' },
];
