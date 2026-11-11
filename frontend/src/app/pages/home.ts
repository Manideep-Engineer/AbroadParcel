import { Component, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BANNED_ITEMS } from '../core/api';

const BOARD_ROUTES = [
  ['DEL', 'Delhi', 'JFK', 'New York'],
  ['YYZ', 'Toronto', 'LAX', 'Los Angeles'],
  ['SFO', 'San Francisco', 'HYD', 'Hyderabad'],
  ['BOM', 'Mumbai', 'EWR', 'Newark'],
  ['ORD', 'Chicago', 'YVR', 'Vancouver'],
  ['BLR', 'Bengaluru', 'SEA', 'Seattle'],
  ['YUL', 'Montreal', 'BOS', 'Boston'],
  ['DFW', 'Dallas', 'MAA', 'Chennai'],
];

const ROWS = 4;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

interface BoardRow {
  from: string;
  fromCity: string;
  to: string;
  toCity: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section class="hero">
      <div class="wrap hero-in">
        <div>
          <span class="eyebrow">Peer-to-peer airport delivery</span>
          <h1>Your parcel. Someone's <em>spare suitcase.</em></h1>
          <p class="sub">
            Send documents, gifts and forgotten belongings with verified travelers already flying your route.
            Your payment stays on hold until the recipient confirms delivery.
          </p>
          <div class="row">
            <a class="btn btn-signal btn-on-dark" routerLink="/parcels/new">Send a parcel</a>
            <a class="btn btn-on-dark" routerLink="/trips/new">Earn on your flight</a>
          </div>
        </div>

        <div class="board" role="img" aria-label="Departure board showing example routes between India, Canada and the USA">
          <div class="board-head">
            <span>ROUTES WE SERVE</span>
            <span class="board-dot"></span>
          </div>
          @for (row of rows(); track $index) {
            <div class="board-row">
              <div class="flaps">
                @for (c of row.from; track $index) {
                  <span class="flap">{{ c }}</span>
                }
              </div>
              <span class="board-arrow">→</span>
              <div class="flaps">
                @for (c of row.to; track $index) {
                  <span class="flap">{{ c }}</span>
                }
              </div>
              <span class="board-city">{{ row.fromCity }}<br />{{ row.toCity }}</span>
            </div>
          }
          <div class="board-foot">Example routes. India ⇄ USA and Canada ⇄ USA, both ways.</div>
        </div>
      </div>
    </section>

    <div class="strip" aria-hidden="true">
      <div class="strip-in">
        @for (n of [1, 2]; track n) {
          <span>Free to join</span><span>Free to chat</span><span>Verified members</span><span>Open inspection</span><span>Paid on delivery PIN</span><span>India ⇄ USA</span><span>Canada ⇄ USA</span>
        }
      </div>
    </div>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <span class="eyebrow">Three people, one parcel</span>
          <h2>Everyone knows where they stand.</h2>
        </div>
        <div class="roles">
          <article class="role">
            <span class="eyebrow">01</span>
            <h3>The sender</h3>
            <p>List your item, agree a fee in chat, and pay only when you're ready. The traveler gets the money after delivery.</p>
          </article>
          <article class="role">
            <span class="eyebrow">02</span>
            <h3>The traveler</h3>
            <p>Turn spare kilos into cash towards your trip. You inspect every item, and you can always say no.</p>
          </article>
          <article class="role">
            <span class="eyebrow">03</span>
            <h3>The recipient</h3>
            <p>No account needed. Get a link by SMS or WhatsApp, inspect the item, show ID, and share your PIN.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section section-dark" id="how">
      <div class="wrap">
        <div class="section-head">
          <span class="eyebrow">How it works</span>
          <h2>From listing to landing in six legs.</h2>
        </div>
        <div class="journey">
          <article class="leg"><b>LEG 01</b><h3>List</h3><p>Senders list an item. Travelers list a verified flight with the kilos they can carry.</p></article>
          <article class="leg"><b>LEG 02</b><h3>Chat</h3><p>Chat for free to agree the delivery fee, item details and a meeting place near the airport.</p></article>
          <article class="leg"><b>LEG 03</b><h3>Hold</h3><p>The sender pays the delivery fee and processing fee. Adyen holds the payment.</p></article>
          <article class="leg"><b>LEG 04</b><h3>Hand over</h3><p>The traveler inspects the unsealed item, then enters the sender's 6-digit code to accept it.</p></article>
          <article class="leg"><b>LEG 05</b><h3>Fly</h3><p>The item travels in the traveler's luggage. The recipient meets them near the destination airport.</p></article>
          <article class="leg"><b>LEG 06</b><h3>Release</h3><p>The recipient inspects, shows ID and shares the PIN. The traveler enters it and gets paid.</p></article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <span class="eyebrow">Why not a courier?</span>
          <h2>Carried by a person, not a sorting belt.</h2>
        </div>
        <div class="table-scroll" style="overflow-x: auto">
          <table class="compare">
            <thead>
              <tr><th scope="col"></th><th scope="col">Traditional air courier</th><th scope="col">AbroadParcel</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Speed</th><td>Moves on the carrier's own schedule</td><td>Arrives on the traveler's flight</td></tr>
              <tr><th scope="row">Pricing</th><td>Base fees, surcharges and dimensional weight</td><td>A delivery fee you agree directly, plus a processing fee</td></tr>
              <tr><th scope="row">Handling</th><td>Sorting hubs, belts and warehouses</td><td>Carried in the traveler's personal luggage</td></tr>
              <tr><th scope="row">Who earns</th><td>The logistics carrier</td><td>The traveler, towards their trip costs</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="section" id="rules" style="padding-top: 0">
      <div class="wrap rules">
        <div>
          <div class="section-head" style="margin-bottom: 26px">
            <span class="eyebrow">Item rules</span>
            <h2>If it's sealed, it stays home.</h2>
          </div>
          <div class="rule-list">
            <div><h3>Every item is inspected</h3><p class="muted">Travelers look at every item in person before accepting it.</p></div>
            <div><h3>Everything stays unsealed</h3><p class="muted">That includes documents. No gift-wrapped boxes or mystery parcels.</p></div>
            <div><h3>Every member is verified</h3><p class="muted">Government ID and phone for all members, plus a flight booking for travelers.</p></div>
            <div><h3>The traveler can always decline</h3><p class="muted">If something looks wrong, they walk away and the delivery fee is refunded.</p></div>
          </div>
        </div>
        <div class="card">
          <h3 style="margin-bottom: 16px">Never allowed</h3>
          <div class="chips">
            @for (item of banned; track item) {
              <span class="chip">{{ item }}</span>
            }
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="faq" style="padding-top: 0">
      <div class="wrap faq">
        <div class="section-head"><span class="eyebrow">FAQ</span><h2>Good questions.</h2></div>
        <details>
          <summary>What does it cost?</summary>
          <p>Joining and chatting are free. The sender pays the delivery fee agreed with the traveler, plus a processing fee.</p>
        </details>
        <details>
          <summary>What if my flight is cancelled or delayed?</summary>
          <p>Tell the sender in chat straight away. They can keep the delivery on the new schedule or cancel it. If the flight is cancelled before handover and no new arrangement is made, the sender gets the full delivery fee back. The processing fee isn't refunded.</p>
        </details>
        <details>
          <summary>What if I'm not comfortable carrying an item?</summary>
          <p>You're never obliged to carry anything. Decline at handover, the booking is cancelled, and the delivery fee is refunded to the sender.</p>
        </details>
        <details>
          <summary>How is my money protected?</summary>
          <p>Adyen holds the payment. The traveler can't get the delivery fee until the recipient inspects the item and provides the PIN.</p>
        </details>
        <details>
          <summary>How do travelers get paid?</summary>
          <p>The delivery fee moves to your wallet as soon as you enter the recipient's PIN. You can then request a withdrawal to a bank account, debit card or digital payout method.</p>
        </details>
      </div>
    </section>

    <div class="wrap">
      <section class="cta">
        <h2>Someone is flying your parcel's way.</h2>
        <div class="row">
          <a class="btn btn-ink" routerLink="/browse">Browse trips</a>
          <a class="btn" routerLink="/register">Create a free account</a>
        </div>
      </section>
    </div>
  `,
})
export class Home implements OnDestroy {
  protected readonly banned = BANNED_ITEMS;
  protected readonly rows = signal<BoardRow[]>(BOARD_ROUTES.slice(0, ROWS).map(toRow));

  private next = ROWS;
  private rowIndex = 0;
  private cycle?: ReturnType<typeof setInterval>;
  private scramble?: ReturnType<typeof setInterval>;

  constructor() {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.cycle = setInterval(() => this.flipNext(), 2800);
    }
  }

  ngOnDestroy() {
    clearInterval(this.cycle);
    clearInterval(this.scramble);
  }

  private flipNext() {
    const target = toRow(BOARD_ROUTES[this.next % BOARD_ROUTES.length]);
    const index = this.rowIndex;
    this.next++;
    this.rowIndex = (this.rowIndex + 1) % ROWS;

    let tick = 0;
    clearInterval(this.scramble);
    this.scramble = setInterval(() => {
      tick++;
      const done = tick >= 12;
      this.rows.update((rows) =>
        rows.map((row, i) =>
          i !== index ? row : done ? target : { ...target, from: settle(target.from, tick), to: settle(target.to, tick - 2) },
        ),
      );
      if (done) clearInterval(this.scramble);
    }, 60);
  }
}

function toRow([from, fromCity, to, toCity]: string[]): BoardRow {
  return { from, fromCity, to, toCity };
}

/** Letters lock into place left to right, like a split-flap display settling. */
function settle(word: string, tick: number): string {
  return [...word]
    .map((letter, i) => (tick > 4 + i * 3 ? letter : LETTERS[Math.floor(Math.random() * LETTERS.length)]))
    .join('');
}
