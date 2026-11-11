import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth, errorMessage } from '../core/api';

@Component({
  selector: 'app-auth-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth">
      <aside class="auth-side">
        <span class="eyebrow" style="color: var(--signal)">Free to join · Free to chat</span>
        <h2>Spare kilos, <em>meet</em> waiting parcels.</h2>
        <p>Connecting senders and travelers on India–USA and Canada–USA routes.</p>
      </aside>
      <div class="auth-form">
        <form ngNativeValidate (ngSubmit)="submit()">
          <h1>{{ isRegister() ? 'Create your account' : 'Welcome back' }}</h1>
          @if (error()) {
            <div class="alert alert-error" role="alert">{{ error() }}</div>
          }
          @if (isRegister()) {
            <label class="field">Full name, as on your ID
              <input name="fullName" [(ngModel)]="fullName" required autocomplete="name" />
            </label>
          }
          <label class="field">Email
            <input name="email" type="email" [(ngModel)]="email" required autocomplete="email" />
          </label>
          @if (isRegister()) {
            <label class="field">Phone number, with country code
              <input name="phone" type="tel" [(ngModel)]="phoneNumber" required autocomplete="tel" placeholder="+1 555 010 0000" />
            </label>
          }
          <label class="field">Password
            <input name="password" type="password" [(ngModel)]="password" required minlength="8" [autocomplete]="isRegister() ? 'new-password' : 'current-password'" />
            @if (isRegister()) {
              <span class="hint">At least 8 characters.</span>
            }
          </label>
          <button class="btn btn-signal btn-block" type="submit" [disabled]="busy()">
            {{ busy() ? 'Just a moment…' : isRegister() ? 'Create account' : 'Log in' }}
          </button>
          <p class="small muted">
            @if (isRegister()) {
              Already a member? <a routerLink="/login" [queryParams]="{ next: next() }">Log in</a>
            } @else {
              New here? <a routerLink="/register" [queryParams]="{ next: next() }">Create a free account</a>
            }
          </p>
        </form>
      </div>
    </div>
  `,
})
export class AuthPage {
  private auth = inject(Auth);
  private router = inject(Router);

  readonly mode = input<'login' | 'register'>('login');
  readonly next = input<string>();
  protected isRegister = computed(() => this.mode() === 'register');

  protected fullName = '';
  protected email = '';
  protected phoneNumber = '';
  protected password = '';
  protected busy = signal(false);
  protected error = signal('');

  protected async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.isRegister()) {
        await firstValueFrom(this.auth.register({ fullName: this.fullName, email: this.email, phoneNumber: this.phoneNumber, password: this.password }));
        this.router.navigateByUrl('/verify');
      } else {
        await firstValueFrom(this.auth.login(this.email, this.password));
        this.router.navigateByUrl(safeNext(this.next()) ?? '/dashboard');
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}

/** Only same-site paths, so a crafted link can't send people elsewhere after login. */
function safeNext(next: string | undefined): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}
