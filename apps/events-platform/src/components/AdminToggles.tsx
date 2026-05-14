"use client";

import { useState } from "react";

export function FeaturedToggle({ eventId, initialFeatured }: { eventId: string; initialFeatured: boolean }) {
  const [featured, setFeatured] = useState(initialFeatured);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, action: "toggle_featured" }),
    });
    const data = await res.json();
    if (res.ok) setFeatured(data.is_featured);
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        fontSize: "0.7rem", fontWeight: 900, padding: "3px 10px", borderRadius: 99,
        cursor: "pointer", border: "none", opacity: loading ? 0.5 : 1,
        background: featured ? "#422006" : "#0a0a0a",
        color: featured ? "#fb923c" : "#555",
        outline: featured ? "1px solid #92400e" : "1px solid #2a2a2d",
      }}
    >
      {featured ? "⭐ Featured" : "☆ Feature"}
    </button>
  );
}

export function OrganizerActiveToggle({ organizerId, initialActive }: { organizerId: string; initialActive: boolean }) {
  const [active, setActive] = useState(initialActive);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const res = await fetch("/api/admin/organizers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizerId, action: "toggle_active" }),
    });
    const data = await res.json();
    if (res.ok) setActive(data.active);
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        fontSize: "0.7rem", fontWeight: 900, padding: "3px 10px", borderRadius: 99,
        cursor: "pointer", border: "none", opacity: loading ? 0.5 : 1,
        background: active ? "#0a2a0a" : "#1a0a0a",
        color: active ? "#22c55e" : "#ef4444",
        outline: active ? "1px solid #166534" : "1px solid #7f1d1d",
      }}
    >
      {active ? "Active" : "Inactive"}
    </button>
  );
}
