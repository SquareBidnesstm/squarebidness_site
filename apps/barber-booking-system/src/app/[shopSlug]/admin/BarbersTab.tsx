"use client";

import { useEffect, useState } from "react";

type Barber = {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  role: string;
  active: boolean;
  sort_order: number;
};

type EditState = {
  name: string;
  display_name: string;
  role: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: "", display_name: "", role: "" });
  const [saving, setSaving] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newBarber, setNewBarber] = useState<EditState>({ name: "", display_name: "", role: "Barber" });
  const [addingSaving, setAddingSaving] = useState(false);

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
      if (data.ok) setBarbers(data.barbers);
      else setError(data.error || "Failed to load barbers.");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(b: Barber) {
    setEditingId(b.id);
    setEditState({ name: b.name, display_name: b.display_name || b.name, role: b.role });
    setAddingNew(false);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    const res = await fetch(`/api/${shopSlug}/admin/barbers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editState.name.trim(),
        display_name: editState.display_name.trim() || editState.name.trim(),
        role: editState.role,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setBarbers((prev) => prev.map((b) => (b.id === id ? data.barber : b)));
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
      setBarbers((prev) => prev.map((x) => (x.id === b.id ? data.barber : x)));
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
      setBarbers((prev) => [...prev, data.barber]);
      setNewBarber({ name: "", display_name: "", role: "Barber" });
      setAddingNew(false);
    }
    setAddingSaving(false);
  }

  if (loading) return <div style={emptyBox}>Loading barbers...</div>;
  if (error) return <div style={{ ...emptyBox, color: "#ffb3b3", borderColor: "#532323" }}>{error}</div>;

  const activeBarbers = barbers.filter((b) => b.active);
  const inactiveBarbers = barbers.filter((b) => !b.active);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Barbers</h2>
          <p style={{ margin: "4px 0 0", color: "#666", fontSize: 13 }}>
            {activeBarbers.length} active · {inactiveBarbers.length} inactive
          </p>
        </div>
        <button
          onClick={() => { setAddingNew(true); setEditingId(null); }}
          style={goldButton}
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

      {/* Active barbers */}
      <div style={{ display: "grid", gap: 12 }}>
        {barbers.map((b) => {
          const isEditing = editingId === b.id;

          return (
            <div
              key={b.id}
              style={{ ...cardStyle, opacity: b.active ? 1 : 0.45 }}
            >
              {isEditing ? (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12, marginBottom: 14 }}>
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
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
                    </div>
                    <div style={{ color: "#666", fontSize: 13 }}>
                      {b.role} · <span style={{ color: "#555" }}>/{b.slug}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => startEdit(b)} style={secondaryButton}>
                      Edit
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
              )}
            </div>
          );
        })}
      </div>

      {barbers.length === 0 && !addingNew && (
        <div style={emptyBox}>No barbers yet. Add one above.</div>
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
