"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const v = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const suf = h >= 12 ? "PM" : "AM";
    const dh = h % 12 === 0 ? 12 : h % 12;
    TIME_OPTIONS.push({ value: v, label: `${dh}:${String(m).padStart(2, "0")} ${suf}` });
  }
}

type HourRow = { day_of_week: number; is_closed: boolean; open_time: string | null; close_time: string | null };

const DEFAULT_SHOP_HOURS: HourRow[] = [
  { day_of_week: 0, is_closed: true, open_time: null, close_time: null },
  { day_of_week: 1, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 2, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 3, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 4, is_closed: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 5, is_closed: false, open_time: "09:00", close_time: "19:00" },
  { day_of_week: 6, is_closed: false, open_time: "08:00", close_time: "16:00" },
];

type Barber = {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  role: string;
  active: boolean;
  sort_order: number;
  has_pin: boolean;
  photo_url?: string | null;
};

type BarberPerms = {
  can_edit_hours: boolean;
  can_edit_prices: boolean;
};

type EditState = {
  name: string;
  display_name: string;
  role: string;
  bio?: string;
};

const COMMON_ROLES = [
  "Barber", "Head Barber", "Master Barber", "Apprentice",
  "Stylist", "Master Stylist", "Cosmetologist", "Color Specialist", "Braider",
  "Nail Technician", "Nail Artist",
  "Esthetician", "Massage Therapist", "Facialist",
  "Lash Artist", "Lash Tech",
  "Specialist", "Owner",
];

export default function BarbersTab({ shopSlug }: { shopSlug: string }) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barberLimit, setBarberLimit] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: "", display_name: "", role: "", bio: "" });
  const [saving, setSaving] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newBarber, setNewBarber] = useState<EditState>({ name: "", display_name: "", role: "Barber", bio: "" });
  const [barberBios, setBarberBios] = useState<Record<string, string>>({});
  const [addingSaving, setAddingSaving] = useState(false);
  const [hoursOpen, setHoursOpen] = useState<string | null>(null);
  const [barberHours, setBarberHours] = useState<Record<string, HourRow[]>>({});
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSaved, setHoursSaved] = useState<string | null>(null);

  // Photo upload state
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // PIN state
  const [pinOpenId, setPinOpenId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Permissions state
  const [perms, setPerms] = useState<Record<string, BarberPerms>>({});
  const [permsLoaded, setPermsLoaded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopSlug]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/${shopSlug}/admin/barbers`);
      const data = await res.json();
      if (data.ok) {
        setBarbers(data.barbers);
        setBarberLimit(data.barberLimit ?? 0);
        // Load bios for all barbers
        const biosRes = await fetch(`/api/${shopSlug}/admin/barbers/bios`);
        if (biosRes.ok) {
          const biosData = await biosRes.json();
          if (biosData.ok) setBarberBios(biosData.bios ?? {});
        }
      } else {
        setError(data.error || "Failed to load barbers.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  const loadBarberHours = useCallback(async (barberId: string) => {
    if (barberHours[barberId]) return;
    const res = await fetch(`/api/${shopSlug}/admin/barbers/${barberId}/hours`);
    const data = await res.json();
    if (data.ok) {
      const loaded: HourRow[] = data.hours;
      const merged = DEFAULT_SHOP_HOURS.map((def) => loaded.find((h) => h.day_of_week === def.day_of_week) ?? def);
      setBarberHours((prev) => ({ ...prev, [barberId]: merged }));
    }
  }, [shopSlug, barberHours]);

  function updateBarberHourDay(barberId: string, dayIndex: number, field: keyof HourRow, value: string | boolean | null) {
    setBarberHours((prev) => ({
      ...prev,
      [barberId]: (prev[barberId] ?? DEFAULT_SHOP_HOURS).map((h) =>
        h.day_of_week === dayIndex ? { ...h, [field]: value } : h
      ),
    }));
    setHoursSaved(null);
  }

  async function saveBarberHours(barberId: string) {
    const hours = barberHours[barberId];
    if (!hours) return;
    setHoursSaving(true);
    const res = await fetch(`/api/${shopSlug}/admin/barbers/${barberId}/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    const data = await res.json();
    if (data.ok) { setHoursSaved(barberId); setTimeout(() => setHoursSaved(null), 3000); }
    setHoursSaving(false);
  }

  async function clearBarberHours(barberId: string) {
    await fetch(`/api/${shopSlug}/admin/barbers/${barberId}/hours`, { method: "DELETE" });
    setBarberHours((prev) => { const n = { ...prev }; delete n[barberId]; return n; });
    setHoursOpen(null);
  }

  function startEdit(b: Barber) {
    setEditingId(b.id);
    setEditState({ name: b.name, display_name: b.display_name || b.name, role: b.role, bio: barberBios[b.id] ?? "" });
    setAddingNew(false);
    setPinOpenId(null);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    const [res] = await Promise.all([
      fetch(`/api/${shopSlug}/admin/barbers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editState.name.trim(),
          display_name: editState.display_name.trim() || editState.name.trim(),
          role: editState.role,
        }),
      }),
      fetch(`/api/${shopSlug}/admin/barbers/${id}/bio`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: editState.bio.trim() }),
      }),
    ]);
    const data = await res.json();
    if (data.ok) {
      setBarbers((prev) => prev.map((b) => (b.id === id ? { ...data.barber, has_pin: b.has_pin } : b)));
      setBarberBios((prev) => ({ ...prev, [id]: editState.bio.trim() }));
      setEditingId(null);
    }
    setSaving(false);
  }

  async function toggleActive(b: Barber) {
    const res = await fetch(`/api/${shopSlug}/admin/barbers/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !b.active }),
    });
    const data = await res.json();
    if (data.ok) {
      setBarbers((prev) => prev.map((x) => (x.id === b.id ? { ...data.barber, has_pin: b.has_pin } : x)));
    }
  }

  async function addBarber() {
    if (!newBarber.name.trim()) return;
    setAddingSaving(true);
    const res = await fetch(`/api/${shopSlug}/admin/barbers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newBarber.name.trim(),
        display_name: newBarber.display_name.trim() || newBarber.name.trim(),
        role: newBarber.role,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setBarbers((prev) => [...prev, { ...data.barber, has_pin: false }]);
      setNewBarber({ name: "", display_name: "", role: "Barber" });
      setAddingNew(false);
    } else {
      alert(data.error || "Could not add barber.");
    }
    setAddingSaving(false);
  }

  function openPin(barberId: string) {
    setPinOpenId(barberId);
    setPinInput("");
    setPinError("");
    setPinSuccess("");
    setHoursOpen(null);
    setEditingId(null);
  }

  async function savePin(barberId: string) {
    setPinError("");
    setPinSuccess("");
    if (!pinInput || !/^\d{4,12}$/.test(pinInput)) {
      setPinError("PIN must be 4–12 digits.");
      return;
    }
    setPinSaving(true);
    const res = await fetch(`/api/${shopSlug}/admin/barbers/${barberId}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pinInput }),
    });
    const data = await res.json();
    if (data.ok) {
      setPinSuccess("PIN saved!");
      setPinInput("");
      setBarbers((prev) => prev.map((b) => (b.id === barberId ? { ...b, has_pin: true } : b)));
      setTimeout(() => { setPinOpenId(null); setPinSuccess(""); }, 1500);
    } else {
      setPinError(data.error || "Could not save PIN.");
    }
    setPinSaving(false);
  }

  async function clearPin(barberId: string) {
    if (!confirm("Remove this barber's PIN? They won't be able to log in until a new one is set.")) return;
    await fetch(`/api/${shopSlug}/admin/barbers/${barberId}/pin`, { method: "DELETE" });
    setBarbers((prev) => prev.map((b) => (b.id === barberId ? { ...b, has_pin: false } : b)));
    setPinOpenId(null);
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/${shopSlug}/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(slug);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  async function loadPerms(barberId: string) {
    if (permsLoaded[barberId]) return;
    const res = await fetch(`/api/${shopSlug}/admin/barbers/${barberId}/perms`);
    const data = await res.json();
    if (data.ok) {
      setPerms((prev) => ({ ...prev, [barberId]: data.perms }));
      setPermsLoaded((prev) => ({ ...prev, [barberId]: true }));
    }
  }

  async function togglePerm(barberId: string, perm: keyof BarberPerms) {
    const current = perms[barberId] ?? { can_edit_hours: false, can_edit_prices: false };
    const updated = { ...current, [perm]: !current[perm] };
    setPerms((prev) => ({ ...prev, [barberId]: updated }));
    await fetch(`/api/${shopSlug}/admin/barbers/${barberId}/perms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  }

  async function uploadBarberPhoto(barberId: string, file: File) {
    setUploadingPhotoId(barberId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "barber_photo");
      fd.append("barber_id", barberId);
      const res = await fetch(`/api/${shopSlug}/admin/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) {
        setBarbers((prev) => prev.map((b) => b.id === barberId ? { ...b, photo_url: data.url } : b));
      }
    } finally {
      setUploadingPhotoId(null);
    }
  }

  if (loading) return <div style={emptyBox}>Loading barbers...</div>;
  if (error) return <div style={{ ...emptyBox, color: "#ffb3b3", borderColor: "#532323" }}>{error}</div>;

  const activeBarbers = barbers.filter((b) => b.active);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Barbers</h2>
          <p style={{ margin: "4px 0 0", color: "#666", fontSize: 13 }}>
            {activeBarbers.length} active
            {barberLimit > 0 ? ` · ${barberLimit - activeBarbers.length} slot${barberLimit - activeBarbers.length !== 1 ? "s" : ""} remaining (limit ${barberLimit})` : " · Upgrade to Pro to add barbers"}
          </p>
        </div>
        <button
          onClick={() => {
            if (barberLimit === 0) {
              alert("Upgrade to Pro to add barbers.");
              return;
            }
            if (activeBarbers.length >= barberLimit) {
              alert(`You've reached your ${barberLimit}-barber limit. Contact support to increase your limit.`);
              return;
            }
            setAddingNew(true);
            setEditingId(null);
            setPinOpenId(null);
          }}
          style={{
            ...goldButton,
            opacity: (barberLimit === 0 || activeBarbers.length >= barberLimit) ? 0.5 : 1,
          }}
        >
          + Add Barber
        </button>
      </div>

      {/* Add new barber form */}
      {addingNew && (
        <div style={{ ...cardStyle, marginBottom: 16, border: "1px solid #3a3000" }}>
          <div style={{ color: "#d4af37", fontSize: 13, marginBottom: 14, fontWeight: 700 }}>
            New Barber
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={labelStyle}>Full Name</div>
              <input
                value={newBarber.name}
                onChange={(e) => setNewBarber((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Marcus Johnson"
                style={inputStyle}
                autoFocus
              />
            </div>
            <div>
              <div style={labelStyle}>Display Name <span style={{ color: "#555" }}>(shown to clients)</span></div>
              <input
                value={newBarber.display_name}
                onChange={(e) => setNewBarber((p) => ({ ...p, display_name: e.target.value }))}
                placeholder="e.g. Marcus or Marcus J."
                style={inputStyle}
              />
            </div>
            <div>
              <div style={labelStyle}>Role</div>
              <select
                value={newBarber.role}
                onChange={(e) => setNewBarber((p) => ({ ...p, role: e.target.value }))}
                style={inputStyle}
              >
                {COMMON_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={addBarber}
              disabled={addingSaving || !newBarber.name.trim()}
              style={{ ...goldButton, opacity: addingSaving ? 0.6 : 1, cursor: addingSaving ? "not-allowed" : "pointer" }}
            >
              {addingSaving ? "Saving..." : "Save Barber"}
            </button>
            <button
              onClick={() => { setAddingNew(false); setNewBarber({ name: "", display_name: "", role: "Barber" }); }}
              style={secondaryButton}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Barber list */}
      <div style={{ display: "grid", gap: 12 }}>
        {barbers.map((b) => {
          const isEditing = editingId === b.id;
          const isPinOpen = pinOpenId === b.id;
          const barberPageUrl = `/${shopSlug}/${b.slug}`;

          return (
            <div
              key={b.id}
              style={{ ...cardStyle, opacity: b.active ? 1 : 0.45 }}
            >
              {isEditing ? (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={labelStyle}>Full Name</div>
                      <input
                        value={editState.name}
                        onChange={(e) => setEditState((p) => ({ ...p, name: e.target.value }))}
                        style={inputStyle}
                        autoFocus
                      />
                    </div>
                    <div>
                      <div style={labelStyle}>Display Name</div>
                      <input
                        value={editState.display_name}
                        onChange={(e) => setEditState((p) => ({ ...p, display_name: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <div style={labelStyle}>Role</div>
                      <select
                        value={editState.role}
                        onChange={(e) => setEditState((p) => ({ ...p, role: e.target.value }))}
                        style={inputStyle}
                      >
                        {COMMON_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={labelStyle}>Bio <span style={{ color: "#555", fontWeight: 400 }}>(shown on booking page · max 500 chars)</span></div>
                    <textarea
                      value={editState.bio}
                      onChange={(e) => setEditState((p) => ({ ...p, bio: e.target.value.slice(0, 500) }))}
                      rows={3}
                      placeholder="Short bio shown to customers on the booking page…"
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => saveEdit(b.id)}
                      disabled={saving || !editState.name.trim()}
                      style={{ ...goldButton, opacity: saving ? 0.6 : 1 }}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditingId(null)} style={secondaryButton}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      {/* Photo avatar */}
                      <div
                        onClick={() => photoInputRefs.current[b.id]?.click()}
                        title="Click to upload photo"
                        style={{
                          width: 52, height: 52, borderRadius: "50%",
                          background: "#1a1a1a", border: "1px solid #2a2a2a",
                          overflow: "hidden", flexShrink: 0, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          position: "relative",
                        }}
                      >
                        {uploadingPhotoId === b.id ? (
                          <span style={{ color: "#555", fontSize: 11 }}>…</span>
                        ) : b.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.photo_url} alt={b.display_name || b.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ color: "#444", fontSize: 20 }}>📷</span>
                        )}
                      </div>
                      <input
                        ref={(el) => { photoInputRefs.current[b.id] = el; }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadBarberPhoto(b.id, f);
                          e.target.value = "";
                        }}
                      />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 18, fontWeight: 700 }}>
                          {b.display_name || b.name}
                        </span>
                        {b.display_name && b.display_name !== b.name && (
                          <span style={{ color: "#555", fontSize: 13 }}>({b.name})</span>
                        )}
                        {!b.active && (
                          <span style={{ color: "#ff5555", fontSize: 12, fontWeight: 700 }}>Inactive</span>
                        )}
                        {b.has_pin ? (
                          <span style={{ color: "#5cd600", fontSize: 11, fontWeight: 700, background: "#0d2200", border: "1px solid #1e4400", borderRadius: 999, padding: "2px 8px" }}>
                            PIN set
                          </span>
                        ) : (
                          <span style={{ color: "#ff9955", fontSize: 11, fontWeight: 700, background: "#1a0a00", border: "1px solid #331500", borderRadius: 999, padding: "2px 8px" }}>
                            No PIN
                          </span>
                        )}
                      </div>
                      <div style={{ color: "#666", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                        <span>{b.role}</span>
                        <span style={{ color: "#333" }}>·</span>
                        <a
                          href={barberPageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#555", textDecoration: "none", fontFamily: "monospace", fontSize: 12 }}
                        >
                          /{shopSlug}/{b.slug}
                        </a>
                        <button
                          onClick={() => copyLink(b.slug)}
                          style={{ ...tinyButton, color: copied === b.slug ? "#5cd600" : "#555" }}
                        >
                          {copied === b.slug ? "Copied!" : "Copy link"}
                        </button>
                      </div>
                    </div>
                    </div>{/* end photo+name flex */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => startEdit(b)} style={secondaryButton}>
                        Edit
                      </button>
                      <button
                        onClick={() => isPinOpen ? setPinOpenId(null) : openPin(b.id)}
                        style={{
                          ...secondaryButton,
                          color: isPinOpen ? "#d4af37" : "#fff",
                          borderColor: isPinOpen ? "#3a2a00" : "#2d2d2d",
                        }}
                      >
                        {b.has_pin ? "Reset PIN" : "Set PIN"}
                      </button>
                      <button
                        onClick={() => {
                          const next = hoursOpen === b.id ? null : b.id;
                          setHoursOpen(next);
                          if (next) { loadBarberHours(b.id); loadPerms(b.id); }
                        }}
                        style={{
                          ...secondaryButton,
                          color: hoursOpen === b.id ? "#d4af37" : "#fff",
                          borderColor: hoursOpen === b.id ? "#3a2a00" : "#2d2d2d",
                        }}
                      >
                        Hours
                      </button>
                      <button
                        onClick={() => toggleActive(b)}
                        style={{
                          ...secondaryButton,
                          color: b.active ? "#ff7070" : "#5cd600",
                          borderColor: b.active ? "#440000" : "#1e4400",
                        }}
                      >
                        {b.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>

                  {/* Permissions panel — load on first expand */}
                  {(() => {
                    const bp = perms[b.id] ?? { can_edit_hours: false, can_edit_prices: false };
                    const hasAnyPerm = bp.can_edit_hours || bp.can_edit_prices;
                    return (
                      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                        <span style={{ color: "#444", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          Barber can edit:
                        </span>
                        {/* Can edit hours toggle */}
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                          onClick={() => { loadPerms(b.id); togglePerm(b.id, "can_edit_hours"); }}>
                          <div style={{
                            width: 34, height: 18, borderRadius: 999, border: "none",
                            background: bp.can_edit_hours ? "#d4af37" : "#2a2a2a",
                            position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.15s",
                          }}>
                            <span style={{
                              position: "absolute", top: 2,
                              left: bp.can_edit_hours ? 18 : 2, width: 14, height: 14,
                              borderRadius: "50%", background: "#fff", transition: "left 0.15s",
                            }} />
                          </div>
                          <span style={{ fontSize: 13, color: bp.can_edit_hours ? "#d4af37" : "#555", fontWeight: 600 }}>
                            Own hours
                          </span>
                        </label>
                        {/* Can edit prices toggle */}
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                          onClick={() => { loadPerms(b.id); togglePerm(b.id, "can_edit_prices"); }}>
                          <div style={{
                            width: 34, height: 18, borderRadius: 999, border: "none",
                            background: bp.can_edit_prices ? "#d4af37" : "#2a2a2a",
                            position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.15s",
                          }}>
                            <span style={{
                              position: "absolute", top: 2,
                              left: bp.can_edit_prices ? 18 : 2, width: 14, height: 14,
                              borderRadius: "50%", background: "#fff", transition: "left 0.15s",
                            }} />
                          </div>
                          <span style={{ fontSize: 13, color: bp.can_edit_prices ? "#d4af37" : "#555", fontWeight: 600 }}>
                            Own prices
                          </span>
                        </label>
                        {hasAnyPerm && (
                          <span style={{ fontSize: 11, color: "#3a3a3a", marginLeft: 4 }}>
                            Changes visible on their schedule page
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* PIN panel */}
                  {isPinOpen && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1a1a1a" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#d4af37", marginBottom: 10 }}>
                        {b.has_pin ? "Reset" : "Set"} PIN for {b.display_name || b.name}
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={pinInput}
                          onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 12)); setPinError(""); }}
                          placeholder="4–12 digit PIN"
                          autoFocus
                          style={{ ...inputStyle, width: 160, textAlign: "center", letterSpacing: "0.2em", fontSize: 18 }}
                        />
                        <button
                          onClick={() => savePin(b.id)}
                          disabled={pinSaving || !pinInput}
                          style={{ ...goldButton, opacity: pinSaving || !pinInput ? 0.6 : 1 }}
                        >
                          {pinSaving ? "Saving..." : "Save PIN"}
                        </button>
                        {b.has_pin && (
                          <button
                            onClick={() => clearPin(b.id)}
                            style={{ ...secondaryButton, color: "#ff7070", borderColor: "#440000" }}
                          >
                            Remove PIN
                          </button>
                        )}
                        <button onClick={() => setPinOpenId(null)} style={secondaryButton}>
                          Cancel
                        </button>
                      </div>
                      {pinError && <div style={{ color: "#ff7070", fontSize: 13, marginTop: 8 }}>{pinError}</div>}
                      {pinSuccess && <div style={{ color: "#5cd600", fontSize: 13, marginTop: 8 }}>{pinSuccess}</div>}
                    </div>
                  )}
                </div>
              )}

              {/* Barber hours editor */}
              {hoursOpen === b.id && !isEditing && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #1a1a1a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#d4af37" }}>Custom Hours for {b.display_name || b.name}</div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>Overrides shop hours. Leave default to use shop hours.</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => clearBarberHours(b.id)} style={{ ...secondaryButton, fontSize: 12, padding: "6px 12px", color: "#ff7070", borderColor: "#440000" }}>
                        Reset to shop hours
                      </button>
                      <button
                        onClick={() => saveBarberHours(b.id)}
                        disabled={hoursSaving}
                        style={{ ...goldButton, fontSize: 12, padding: "6px 14px" }}
                      >
                        {hoursSaving ? "Saving..." : hoursSaved === b.id ? "✓ Saved" : "Save"}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {(barberHours[b.id] ?? DEFAULT_SHOP_HOURS).map((h) => (
                      <div key={h.day_of_week} style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12, alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => updateBarberHourDay(b.id, h.day_of_week, "is_closed", !h.is_closed)}
                            style={{
                              width: 34, height: 18, borderRadius: 999, border: "none",
                              background: !h.is_closed ? "#d4af37" : "#333", position: "relative", cursor: "pointer", flexShrink: 0,
                            }}
                          >
                            <span style={{
                              position: "absolute", top: 2,
                              left: !h.is_closed ? 18 : 2, width: 14, height: 14,
                              borderRadius: "50%", background: "#fff", transition: "left 0.15s",
                            }} />
                          </button>
                          <span style={{ fontSize: 13, color: h.is_closed ? "#555" : "#fff", fontWeight: 600 }}>
                            {DAY_FULL[h.day_of_week].slice(0, 3)}
                          </span>
                        </div>
                        {h.is_closed ? (
                          <span style={{ fontSize: 12, color: "#555" }}>Closed</span>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <select value={h.open_time ?? "09:00"} onChange={(e) => updateBarberHourDay(b.id, h.day_of_week, "open_time", e.target.value)} style={smallSelect}>
                              {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <span style={{ color: "#555", fontSize: 12 }}>–</span>
                            <select value={h.close_time ?? "18:00"} onChange={(e) => updateBarberHourDay(b.id, h.day_of_week, "close_time", e.target.value)} style={smallSelect}>
                              {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {barbers.length === 0 && !addingNew && (
        <div style={emptyBox}>
          {barberLimit === 0
            ? "Upgrade to Pro to add barbers and give each their own schedule page."
            : "No barbers yet. Add one above."}
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #232323",
  background: "#070707",
  borderRadius: 16,
  padding: 18,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
  marginBottom: 6,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#111",
  border: "1px solid #2a2a2a",
  color: "#fff",
  borderRadius: 8,
  fontSize: 15,
  outline: "none",
};

const emptyBox: React.CSSProperties = {
  border: "1px dashed #2a2a2a",
  borderRadius: 18,
  padding: 28,
  textAlign: "center",
  color: "#9a9a9a",
  background: "#070707",
};

const goldButton: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "#d4af37",
  color: "#000",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};

const smallSelect: React.CSSProperties = {
  padding: "6px 10px",
  background: "#111",
  border: "1px solid #2a2a2a",
  color: "#fff",
  borderRadius: 6,
  fontSize: 13,
  outline: "none",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid #2d2d2d",
  background: "#111",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
};

const tinyButton: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 6,
  border: "1px solid #2d2d2d",
  background: "transparent",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 11,
  whiteSpace: "nowrap",
};
