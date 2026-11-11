import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth, User, errorMessage } from '../core/api';

@Component({
  selector: 'app-verify',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page wrap" style="max-width: 720px">
      <div class="page-head">
        <div>
          <h1>Get verified</h1>
          <p class="lead">You need a verified phone and government ID before you can list items or chat.</p>
        </div>
      </div>

      @if (error()) {
        <div class="alert alert-error" role="alert" style="margin-bottom: 16px">{{ error() }}</div>
      }

      @if (auth.user(); as user) {
        <div class="stack">
          <section class="card check-step">
            <span class="check-num" [class.done]="user.phoneVerified">{{ user.phoneVerified ? '✓' : '1' }}</span>
            <div class="stack" style="flex: 1">
              <div>
                <h3>Phone number</h3>
                <p class="muted">{{ user.phoneNumber }}</p>
              </div>
              @if (!user.phoneVerified) {
                @if (!codeSent()) {
                  <div><button type="button" class="btn btn-signal" [disabled]="busy()" (click)="sendCode()">Send code</button></div>
                } @else {
                  <form ngNativeValidate class="row" (ngSubmit)="confirmCode()">
                    <input class="code-input" style="flex: 1; min-width: 180px; min-height: 52px; border: 1.5px solid var(--line); border-radius: 12px" name="code" aria-label="6-digit code" inputmode="numeric" maxlength="6" [(ngModel)]="code" required />
                    <button type="submit" class="btn btn-ink" [disabled]="busy()">Confirm</button>
                  </form>
                }
              }
            </div>
          </section>

          <section class="card check-step">
            <span class="check-num" [class.done]="user.idStatus === 'Approved'">{{ user.idStatus === 'Approved' ? '✓' : '2' }}</span>
            <div class="stack" style="flex: 1">
              <div>
                <h3>Government ID</h3>
                <p class="muted">Upload a photo or PDF of a valid ID. Only the admin can view it.</p>
              </div>
              @switch (user.idStatus) {
                @case ('Pending') {
                  <div class="alert alert-warn">Your ID is being reviewed.</div>
                }
                @case ('Approved') {
                  <div class="alert alert-ok">Your ID is approved.</div>
                }
                @case ('Rejected') {
                  <div class="alert alert-error">Your ID was rejected{{ user.idRejectionReason ? ': ' + user.idRejectionReason : '.' }} Please upload it again.</div>
                }
              }
              @if (user.idStatus === 'NotSubmitted' || user.idStatus === 'Rejected') {
                <label class="field">ID document
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" [disabled]="busy()" (change)="uploadId($event)" />
                  <span class="hint">JPG, PNG, WebP or PDF, up to 8 MB.</span>
                </label>
              }
            </div>
          </section>

          @if (user.isVerified) {
            <div class="row"><a class="btn btn-signal" routerLink="/dashboard">Go to dashboard</a></div>
          }
        </div>
      } @else {
        <div class="loading"></div>
      }
    </div>
  `,
})
export class Verify {
  private http = inject(HttpClient);
  protected auth = inject(Auth);

  protected code = '';
  protected codeSent = signal(false);
  protected busy = signal(false);
  protected error = signal('');

  protected sendCode() {
    this.run(async () => {
      await firstValueFrom(this.http.post('/api/auth/phone/send-code', {}));
      this.codeSent.set(true);
    });
  }

  protected confirmCode() {
    this.run(async () => {
      this.auth.user.set(await firstValueFrom(this.http.post<User>('/api/auth/phone/confirm', { code: this.code })));
    });
  }

  protected uploadId(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    this.run(async () => {
      this.auth.user.set(await firstValueFrom(this.http.post<User>('/api/auth/id-document', form)));
    });
  }

  private async run(action: () => Promise<void>) {
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
