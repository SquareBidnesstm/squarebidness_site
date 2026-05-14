"use client";
import { useState } from "react";

interface Tier {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  quantity_sold: number;
  groupMinQty: number | null;
  groupDiscountPct: number | null;
}

interface PromoResult {
  promoId: string;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  newTotal: number;
}

export default function CheckoutForm({
  eventSlug,
  eventId,
  tiers,
  refCode,
}: {
  eventSlug: string;
  eventId: string;
  tiers: Tier[];
  refCode?: string | null;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [promoCode, setPromoCode] = useState("");
  const [promo, setPromo] = useState<PromoResult | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const availableTiers = tiers.filter(t => t.quantity - t.quantity_sold > 0);

  function effectivePrice(tier: Tier, qty: number): number {
    if (tier.groupMinQty && tier.groupDiscountPct && qty >= tier.groupMinQty) {
      return tier.price * (1 - tier.groupDiscountPct / 100);
    }
    return tier.price;
  }

  const subtotal = availableTiers.reduce((sum, t) => {
    const qty = quantities[t.id] ?? 0;
    return sum + (effectivePrice(t, qty) * qty);
  }, 0);

  const totalQty = Object.values(quantities).reduce((s, q) => s + q, 0);
  const platformFee = availableTiers.reduce((sum, t) => {
    const qty = quantities[t.id] ?? 0;
    if (Number(t.price) === 0) return sum;
    const ep = effectivePrice(t, qty);
    const feePerTicket = 1.50 + ep * 0.02;
    return sum + feePerTicket * qty;
  }, 0);

  const discountAmount = promo ? Math.min(promo.discountAmount, subtotal) : 0;
  const total = Math.max(0, subtotal - discountAmount) + platformFee;

  async function applyPromo() {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    setPromo(null);
    const res = await fetch("/api/promo/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: promoCode, eventId, subtotal }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPromoError(data.error ?? "Invalid code");
    } else {
      setPromo(data);
    }
    setPromoLoading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (totalQty === 0) return;
    setSubmitting(true);
    e.currentTarget.submit();
  }

  return (
    <form action="/api/checkout" method="POST" onSubmit={handleSubmit}>
      <input type="hidden" name="eventSlug" value={eventSlug} />
      {promo && <input type="hidden" name="promoId" value={promo.promoId} />}
      {promo && <input type="hidden" name="promoCode" value={promoCode} />}
      {refCode && <input type="hidden" name="refCode" value={refCode} />}

      {/* Tier selectors */}
      <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        {availableTiers.map((tier) => {
          const max = Math.min(tier.quantity - tier.quantity_sold, 10);
          return (
            <div key={tier.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <label htmlFor={`qty_${tier.id}`} style={{ fontSize: "0.9rem", fontWeight: 700 }}>{tier.name}</label>
                {tier.description && <p style={{ color: "#71717a", fontSize: "0.78rem", margin: "2px 0 0" }}>{tier.description}</p>}
                {tier.groupMinQty && tier.groupDiscountPct && (
                  <p style={{ color: "#facc15", fontSize: "0.72rem", fontWeight: 800, margin: "2px 0 0" }}>
                    Buy {tier.groupMinQty}+ save {tier.groupDiscountPct}%
                  </p>
                )}
                <p style={{ fontSize: "0.85rem", fontWeight: 900, marginTop: 2 }}>
                  {(() => {
                    const qty = quantities[tier.id] ?? 0;
                    const ep = effectivePrice(tier, qty);
                    if (tier.price === 0) return <span style={{ color: "#fff" }}>Free</span>;
                    if (ep < tier.price) return (
                      <>
                        <span style={{ color: "#facc15" }}>${ep.toFixed(2)}</span>
                        <span style={{ color: "#555", textDecoration: "line-through", marginLeft: 6, fontSize: "0.78rem" }}>${tier.price.toFixed(2)}</span>
                      </>
                    );
                    return <span style={{ color: "#fff" }}>${tier.price.toFixed(2)}</span>;
                  })()}
                </p>
              </div>
              <select
                id={`qty_${tier.id}`}
                name={`tier_${tier.id}`}
                className="input"
                style={{ width: 80 }}
                value={quantities[tier.id] ?? 0}
                onChange={e => setQuantities({ ...quantities, [tier.id]: parseInt(e.target.value) })}
              >
                {Array.from({ length: max + 1 }, (_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {/* Buyer info */}
      <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <input name="buyerName" placeholder="Your Name" className="input" required />
        <input name="buyerEmail" type="email" placeholder="your@email.com" className="input" required />
        <input name="buyerPhone" type="tel" placeholder="Phone (optional)" className="input" />
      </div>

      {/* Promo code */}
      {subtotal > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              placeholder="Promo code"
              value={promoCode}
              onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromo(null); setPromoError(""); }}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={applyPromo}
              disabled={promoLoading || !promoCode.trim()}
              className="btn btn--ghost"
              style={{ minHeight: 44, padding: "0 16px", fontSize: "0.85rem" }}
            >
              {promoLoading ? "…" : "Apply"}
            </button>
          </div>
          {promoError && <p style={{ color: "#ef4444", fontSize: "0.82rem", marginTop: 6 }}>{promoError}</p>}
          {promo && (
            <p style={{ color: "#22c55e", fontSize: "0.82rem", marginTop: 6 }}>
              ✓ {promo.discountType === "percent" ? `${promo.discountValue}%` : `$${promo.discountValue}`} off applied — saving ${discountAmount.toFixed(2)}
            </p>
          )}
        </div>
      )}

      {/* Order summary */}
      {totalQty > 0 && (
        <div style={{ background: "#080808", border: "1px solid #1d1d1f", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: "0.85rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#a1a1aa", marginBottom: 4 }}>
            <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#22c55e", marginBottom: 4 }}>
              <span>Discount</span><span>-${discountAmount.toFixed(2)}</span>
            </div>
          )}
          {platformFee > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#555", marginBottom: 4 }}>
              <span>Platform fee</span><span>${platformFee.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, color: "#fff", borderTop: "1px solid #1d1d1f", paddingTop: 8, marginTop: 4 }}>
            <span>Total</span><span>${total.toFixed(2)}</span>
          </div>
        </div>
      )}

      <button
        type="submit"
        className="btn btn--primary btn--wide"
        disabled={totalQty === 0 || submitting}
      >
        {submitting ? "Redirecting…" : "Get Tickets"}
      </button>
      <p style={{ color: "#555", fontSize: "0.78rem", textAlign: "center", marginTop: 10 }}>
        $1.50 + 2% platform fee per paid ticket · Secure checkout
      </p>
    </form>
  );
}
