import { Component, computed, input } from '@angular/core';

const LABELS: Record<string, string> = {
  NotSubmitted: 'Not submitted',
  Pending: 'In review',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Open: 'Open',
  Booked: 'Booked',
  Delivered: 'Delivered',
  Closed: 'Closed',
  Proposed: 'Proposed',
  AwaitingPayment: 'Awaiting payment',
  Held: 'Payment held',
  HandedOver: 'In transit',
  Declined: 'Declined',
  Cancelled: 'Cancelled',
  Requested: 'Requested',
  Paid: 'Paid',
};

const TONES: Record<string, string> = {
  Approved: 'badge-ok',
  Delivered: 'badge-ok',
  Paid: 'badge-ok',
  Open: 'badge-ok',
  Pending: 'badge-warn',
  Proposed: 'badge-warn',
  AwaitingPayment: 'badge-warn',
  Requested: 'badge-warn',
  Rejected: 'badge-bad',
  Declined: 'badge-bad',
  Cancelled: 'badge-bad',
  Closed: 'badge-quiet',
  NotSubmitted: 'badge-quiet',
};

@Component({
  selector: 'app-status',
  template: `<span class="badge" [class]="tone()">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<string>();
  protected label = computed(() => LABELS[this.status()] ?? this.status());
  protected tone = computed(() => `badge ${TONES[this.status()] ?? ''}`);
}
