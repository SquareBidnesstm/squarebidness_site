"use client";

import { useEffect, useState } from "react";

type Service = {
  id: string;
  slug: string;
  name: string;
  duration_minutes: number;
  price: number;
  active: boolean;
  sort_order: number;
};

type EditState = {
  name: string;
  price: string;
  duration_minutes: string;
};

export default function ServicesTab({ shopSlug }: { shopSlug: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: "", price: "", duration_minutes: "" });
  const [saving, setSaving] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newService, setNewService] = useState<EditState>({ name: "", price: "", duration_minutes: "" });
  const [addingSaving, setAddingSaving] = useState(false);

  useEffect(() => {
    load();
  }, [shopSlug]);

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/${shopSlug}/admin/services`);
    const data = await res.json();
    if (data.ok) {
      setServices(data.services);
    } else {
      setError(data.error || "Failed to load services.");
    }
    setLoading(false);
  }

  function startEdit(s: Service) {
    setEditingId(s.id);
    setEditState({
      name: s.name,
      price: String(s.price),
      duration_minutes: String(s.duration_minutes),
    });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    const res = await fetch(`/api/${shopSlug}/admin/services/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editState.name,
        price: parseFloat(editState.price),
        duration_minutes: parseInt(editState.duration_minutes),
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setServices((prev) => prev.map((s) => (s.id === id ? data.service : s)));
      setEditingId(null);
    }
    setSaving(false);
  }

  async function toggleActive(s: Service) {
    const res = await fetch(`/api/${shopSlug}/admin/services/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    const data = await res.json();
    if (data.ok) {
      setServices((prev) => prev.map((sv) => (sv.id === s.id ? data.service : sv)));
    }
  }

  async function addService() {
    if (!newService.name || !newService.price || !newService.duration_minutes) return;
    setAddingSaving(true);
    const res = await fetch(`/api/${shopSlug}/admin/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newService.name,
        price: parseFloat(newService.price),
        duration_minutes: parseInt(newService.duration_minutes),
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setServices((prev) => [...prev, data.service]);
      setNewService({ name: "", price: "", duration_minutes: "" });
      setAddingNew(false);
    }
    setAddingSaving(false);
  }

  if (loading) return <div style={emptyBox}>Loading services...</div>;
  if (error) return <div style={{ ...emptyBox, color: "#ffb3b3", borderColor: "#532323" }}>{error}</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Services</h2>
        <button
          onClick={() => { setAddingNew(true); setEditingId(null); }}
          style={goldButton}
        >
          + Add Service
        </button>
      </div>

      {/* Add new service form */}
      {addingNew && (
        <div style={{ ...cardStyle, marginBottom: 16, border: "1px solid #3a3a00" }}>
          <div style={{ color: "#d4af37", fontSize: 13, marginBottom: 14, fontWeight: 700 }}>
            New Service
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={labelStyle}>Service Name</div>
              <input
                value={newService.name}
                onChange={(e) => setNewService((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Full Color"
                style={inputStyle}
                autoFocus
              />
            </div>
            <div>
              <div style={labelStyle}>Price ($)</div>
              <input
                type="number"
                value={newService.price}
                onChange={(e) => setNewService((p) => ({ ...p, price: e.target.value }))}
                placeholder="0.00"
                style={inputStyle}
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <div style={labelStyle}>Duration (min)</div>
              <input
                type="number"
                value={newService.duration_minutes}
                onChange={(e) => setNewService((p) => ({ ...p, duration_minutes: e.target.value }))}
                placeholder="30"
                style={inputStyle}
                min="1"
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={addService}
              disabled={addingSaving || !newService.name || !newService.price || !newService.duration_minutes}
              style={{
                ...goldButton,
                opacity: addingSaving ? 0.6 : 1,
                cursor: addingSaving ? "not-allowed" : "pointer",
              }}
            >
              {addingSaving ? "Saving..." : "Save Service"}
            </button>
            <button
              onClick={() => { setAddingNew(false); setNewService({ name: "", price: "", duration_minutes: "" }); }}
              style={secondaryButton}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {services.map((s) => {
          const isEditing = editingId === s.id;

          return (
            <div
              key={s.id}
              style={{
                ...cardStyle,
                opacity: s.active ? 1 : 0.45,
              }}
            >
              {isEditing ? (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={labelStyle}>Service Name</div>
                      <input
                        value={editState.name}
                        onChange={(e) => setEditState((p) => ({ ...p, name: e.target.value }))}
                        style={inputStyle}
                        autoFocus
                      />
                    </div>
                    <div>
                      <div style={labelStyle}>Price ($)</div>
                      <input
                        type="number"
                        value={editState.price}
                        onChange={(e) => setEditState((p) => ({ ...p, price: e.target.value }))}
                        style={inputStyle}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <div style={labelStyle}>Duration (min)</div>
                      <input
                        type="number"
                        value={editState.duration_minutes}
                        onChange={(e) => setEditState((p) => ({ ...p, duration_minutes: e.target.value }))}
                        style={inputStyle}
                        min="1"
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => saveEdit(s.id)}
                      disabled={saving}
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{s.name}</div>
                    <div style={{ display: "flex", gap: 16, color: "#9a9a9a", fontSize: 14 }}>
                      <span style={{ color: "#d4af37", fontWeight: 700 }}>${Number(s.price).toFixed(2)}</span>
                      <span>{s.duration_minutes} min</span>
                      {!s.active && (
                        <span style={{ color: "#ff5555" }}>Inactive</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => startEdit(s)} style={secondaryButton}>
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(s)}
                      style={{
                        ...secondaryButton,
                        color: s.active ? "#ff7070" : "#5cd600",
                        borderColor: s.active ? "#440000" : "#1e4400",
                      }}
                    >
                      {s.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {services.length === 0 && !addingNew && (
        <div style={emptyBox}>No services yet. Add one above.</div>
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
