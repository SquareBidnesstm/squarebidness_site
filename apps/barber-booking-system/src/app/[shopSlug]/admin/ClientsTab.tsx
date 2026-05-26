"use client";

import { useEffect, useState } from "react";

type Client = {
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  visits: number;
  no_shows: number;
  last_visit: string;
  services: string[];
};

export default function ClientsTab({ shopSlug }: { shopSlug: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    const qs = query ? `?search=${encodeURIComponent(query)}` : "";
    fetch(`/api/${shopSlug}/admin/clients${qs}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setClients(d.clients ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shopSlug, query]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(search.trim());
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 10,
            border: "1px solid #2d2d2d", background: "#111", color: "#fff", fontSize: 14,
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: "#d4af37", color: "#000", fontWeight: 800, cursor: "pointer",
          }}
        >
          Search
        </button>
        {query && (
          <button
            type="button"
            onClick={() => { setSearch(""); setQuery(""); }}
            style={{
              padding: "10px 14px", borderRadius: 10, border: "1px solid #2d2d2d",
              background: "#111", color: "#888", cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
      </form>

      {loading ? (
        <p style={{ color: "#666" }}>Loading…</p>
      ) : clients.length === 0 ? (
        <p style={{ color: "#666" }}>No clients found.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {clients.map((c) => (
            <ClientRow key={c.customer_phone} client={c} shopSlug={shopSlug} />
          ))}
        </div>
      )}
    </div>
  );
}

type Booking = {
  id: string;
  booking_code: string;
  starts_at: string;
  status: string;
  service_name: string;
  barber_name: string;
  price_snapshot: number;
};

function ClientRow({ client, shopSlug }: { client: Client; shopSlug: string }) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<Booking[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function loadHistory() {
    if (history !== null) { setExpanded((v) => !v); return; }
    setExpanded(true);
    setLoadingHistory(true);
    const phone = encodeURIComponent(client.customer_phone);
    const res = await fetch(`/api/${shopSlug}/admin/clients/history?phone=${phone}`).catch(() => null);
    const d = res ? await res.json().catch(() => null) : null;
    setHistory(d?.bookings ?? []);
    setLoadingHistory(false);
  }

  const lastDate = new Date(client.last_visit).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div
      style={{
        background: "#0d0d0d", border: "1px solid #1d1d1d", borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <button
        onClick={loadHistory}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", background: "transparent", border: "none",
          color: "#fff", cursor: "pointer", textAlign: "left",
        }}
      >
        <div>
          <p style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>{client.customer_name}</p>
          <p style={{ color: "#888", fontSize: 13 }}>{client.customer_phone}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: "#d4af37", fontWeight: 700, fontSize: 14 }}>
            {client.visits} visit{client.visits !== 1 ? "s" : ""}
          </p>
          {client.no_shows > 0 && (
            <span style={{
              display: "inline-block", fontSize: 11, fontWeight: 700,
              padding: "2px 7px", borderRadius: 6,
              background: "#1a0800", color: "#ff9944", border: "1px solid #331500",
            }}>
              {client.no_shows} no-show{client.no_shows > 1 ? "s" : ""}
            </span>
          )}
          <p style={{ color: "#666", fontSize: 12, marginTop: client.no_shows > 0 ? 3 : 0 }}>Last: {lastDate}</p>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid #1d1d1d", padding: "12px 18px" }}>
          {loadingHistory ? (
            <p style={{ color: "#666", fontSize: 13 }}>Loading history…</p>
          ) : !history || history.length === 0 ? (
            <p style={{ color: "#666", fontSize: 13 }}>No booking history found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 12px", background: "#111", borderRadius: 8,
                    border: "1px solid #222",
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                      {b.service_name}
                    </p>
                    <p style={{ color: "#888", fontSize: 12 }}>
                      {new Date(b.starts_at).toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric",
                      })} · {b.barber_name}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                        background: statusColor(b.status).bg,
                        color: statusColor(b.status).text,
                      }}
                    >
                      {b.status}
                    </span>
                    <p style={{ color: "#666", fontSize: 12, marginTop: 2 }}>#{b.booking_code}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function statusColor(status: string) {
  if (status === "confirmed") return { bg: "#0a2200", text: "#5cd600" };
  if (status === "completed") return { bg: "#001a33", text: "#4499ff" };
  if (status === "cancelled") return { bg: "#1a0000", text: "#ff6060" };
  if (status === "no_show") return { bg: "#1a0800", text: "#ff9944" };
  return { bg: "#1a1a00", text: "#dddd44" };
}
