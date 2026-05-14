"use client";

import { useState, useEffect } from "react";

type Barber = { id: string; name: string; display_name: string | null };
type Block = { id: string; barber_id: string | null; title: string; starts_at: string; ends_at: string; barbers?: { name: string; display_name: string | null } | null };

function getTodayString() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const v = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const suf = h >= 12 ? "PM" : "AM";
    const dh = h % 12 === 0 ? 12 : h % 12;
    TIME_OPTIONS.push({ value: v, label: `${dh}:${String(m).padStart(2, "0")} ${suf}` });
  }
}

export default function BlockTimeModal({ shopSlug, onClose }: { shopSlug: string; onClose: () => void }) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);

  const [barberId, setBarberId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(getTodayString());
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/${shopSlug}/admin/barbers`)
      .then(r => r.json())
      .then(d => { if (d.ok) setBarbers((d.barbers ?? []).filter((b: Barber & { active: boolean }) => b.active)); })
      .catch(() => {});
    loadBlocks();
  }, [shopSlug]);

  async function loadBlocks() {
    setLoadingBlocks(true);
    const res = await fetch(`/api/${shopSlug}/admin/blocked-times`);
    const d = await res.json();
    if (d.ok) setBlocks(d.blocks ?? []);
    setLoadingBlocks(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/${shopSlug}/admin/blocked-times`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barber_id: barberId || null, title: title || undefined, date, all_day: allDay, start_time: allDay ? undefined : startTime, end_time: allDay ? undefined : endTime }),
    });
    const d = await res.json();
    if (!res.ok || !d.ok) { setError(d.error ?? "Failed"); }
    else { setTitle(""); await loadBlocks(); }
    setSaving(false);
  }

  async function handleDelete(blockId: string) {
    await fetch(`/api/${shopSlug}/admin/blocked-times/${blockId}`, { method: "DELETE" });
    setBlocks(prev => prev.filter(b => b.id !== blockId));
  }

  function formatBlock(b: Block) {
    const start = new Date(b.starts_at);
    const end = new Date(b.ends_at);
    const sameDay = start.toDateString() === end.toDateString();
    const date = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const allDay = start.getHours() === 0 && end.getHours() === 23;
    if (allDay) return `${date} · All day`;
    const st = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const et = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return sameDay ? `${date} · ${st} – ${et}` : `${date} – ${et}`;
  }

  const upcoming = blocks.filter(b => new Date(b.ends_at) >= new Date());

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ background: "#0d0d0d", border: "1px solid #2d2d2d", borderRadius: 24, padding: 32, width: "100%", maxWidth: 540, margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Block Time</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", fontSize: 24, cursor: "pointer" }}>×</button>
        </div>

        <form onSubmit={handleAdd} style={{ display: "grid", gap: 14, marginBottom: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Barber (leave blank = all)</label>
              <select value={barberId} onChange={e => setBarberId(e.target.value)} style={inp}>
                <option value="">All barbers</option>
                {barbers.map(b => <option key={b.id} value={b.id}>{b.display_name || b.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Label (optional)</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Lunch, Day Off…" style={inp} />
            </div>
          </div>

          <div>
            <label style={lbl}>Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={inp} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={() => setAllDay(v => !v)} style={{ width: 40, height: 22, borderRadius: 11, border: "none", background: allDay ? "#d4af37" : "#2a2a2a", cursor: "pointer", position: "relative", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 2, left: allDay ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: allDay ? "#000" : "#666", transition: "left 0.15s" }} />
            </button>
            <span style={{ color: "#aaa", fontSize: 14 }}>All day</span>
          </div>

          {!allDay && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Start time *</label>
                <select value={startTime} onChange={e => setStartTime(e.target.value)} style={inp}>
                  {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>End time *</label>
                <select value={endTime} onChange={e => setEndTime(e.target.value)} style={inp}>
                  {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={saving} style={{ ...goldBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Blocking…" : "Block This Time"}
          </button>
        </form>

        <div>
          <p style={{ color: "#666", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            Upcoming Blocks ({upcoming.length})
          </p>
          {loadingBlocks ? <p style={{ color: "#555", fontSize: 14 }}>Loading…</p> : upcoming.length === 0 ? (
            <p style={{ color: "#555", fontSize: 14 }}>No upcoming blocks.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {upcoming.map(b => (
                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#070707", border: "1px solid #1d1d1d", borderRadius: 10 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, margin: 0, marginBottom: 2 }}>{b.title}</p>
                    <p style={{ color: "#666", fontSize: 12, margin: 0 }}>
                      {formatBlock(b)}
                      {b.barbers ? ` · ${b.barbers.display_name || b.barbers.name}` : " · All barbers"}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(b.id)} style={{ background: "none", border: "1px solid #440000", color: "#ff7070", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "#666", marginBottom: 5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" };
const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #2d2d2d", background: "#070707", color: "#fff", fontSize: 14, boxSizing: "border-box" };
const goldBtn: React.CSSProperties = { padding: "13px 20px", borderRadius: 12, border: "none", background: "#d4af37", color: "#000", fontWeight: 800, cursor: "pointer", fontSize: 15 };
