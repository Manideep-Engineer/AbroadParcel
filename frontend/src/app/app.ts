import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from './core/api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="nav">
      <div class="wrap nav-in">
        <a class="logo" routerLink="/" (click)="open.set(false)">
          <span class="logo-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
          </span>
          AbroadParcel
        </a>
        <button class="menu-btn" type="button" [attr.aria-expanded]="open()" aria-label="Menu" (click)="open.set(!open())">☰</button>
        <nav class="nav-links" [class.open]="open()" (click)="open.set(false)">
          <a routerLink="/browse" routerLinkActive="active">Browse</a>
          @if (auth.isLoggedIn()) {
            <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
            <a routerLink="/chat" routerLinkActive="active">Messages</a>
            <a routerLink="/wallet" routerLinkActive="active">Wallet</a>
            @if (auth.isAdmin()) {
              <a routerLink="/admin" routerLinkActive="active">Admin</a>
            }
            <button class="link" type="button" (click)="logout()">Log out</button>
          } @else {
            <a routerLink="/" fragment="how">How it works</a>
            <a routerLink="/login" routerLinkActive="active">Log in</a>
            <a class="btn btn-sm btn-signal btn-on-dark" routerLink="/register">Join free</a>
          }
        </nav>
      </div>
    </header>
    <main><router-outlet /></main>
    <footer class="footer">
      <div class="wrap row between">
        <span class="logo">AbroadParcel</span>
        <span class="small">India ⇄ USA · Canada ⇄ USA</span>
        <div class="row small">
          <a routerLink="/" fragment="rules">Item rules</a>
          <a routerLink="/" fragment="faq">FAQ</a>
          <a routerLink="/browse">Browse</a>
        </div>
      </div>
    </footer>
  `,
})
export class App {
  protected auth = inject(Auth);
  private router = inject(Router);
  protected open = signal(false);

  constructor() {
    this.auth.refresh();
  }

  protected logout() {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }
}
