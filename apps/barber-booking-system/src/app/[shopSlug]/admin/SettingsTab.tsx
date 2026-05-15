"use client";

import { useEffect, useRef, useState } from "react";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0d0d0d",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
  color: "#fff",
  padding: "10px 14px",
  fontSize: 14,
  boxSizing: "border-box",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: "#d4af37", marginBottom: 18, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function LogoUpload({
  label,
  currentUrl,
  onUpload,
  uploading,
}: {
  label: string;
  currentUrl: string | null;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 12,
          background: "#111",
          border: "1px solid #2a2a2a",
          overflow: "hidden",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ color: "#444", fontSize: 28 }}>🖼</span>
        )}
      </div>
      <div>
        <div style={{ fontSize: 14, color: "#aaa", marginBottom: 8 }}>{label}</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #2a2a2a",
            background: uploading ? "#111" : "#1a1a1a",
            color: uploading ? "#555" : "#ccc",
            fontSize: 13,
            cursor: uploading ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? "Uploading…" : currentUrl ? "Replace Image" : "Upload Image"}
        </button>
        <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>JPEG, PNG, WebP · max 5MB</div>
      </div>
    </div>
  );
}

export default function SettingsTab({ shopSlug }: { shopSlug: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMsg, setLogoMsg] = useState("");

  // Shop profile fields
  const [shopId, setShopId] = useState("");
  const [shopType, setShopType] = useState("barbershop");
  const [savingType, setSavingType] = useState(false);
  const [typeMsg, setTypeMsg] = useState("");

  useEffect(() => {
    loadSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopSlug]);

  async function loadSettings() {
    const res = await fetch(`/api/${shopSlug}/admin/settings`);
    const data = await res.json();
    if (data.ok) {
      setLogoUrl(data.logo_url ?? null);
      setShopId(data.shop_id ?? "");
      setShopType(data.shop_type ?? "barbershop");
    }
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    setLogoMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "shop_logo");
      const res = await fetch(`/api/${shopSlug}/admin/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) {
        setLogoUrl(data.url);
        setLogoMsg("Logo updated!");
      } else {
        setLogoMsg(data.error ?? "Upload failed");
      }
    } catch {
      setLogoMsg("Upload failed");
    } finally {
      setUploadingLogo(false);
      setTimeout(() => setLogoMsg(""), 3000);
    }
  }

  async function saveShopType() {
    setSavingType(true);
    setTypeMsg("");
    try {
      const res = await fetch(`/api/${shopSlug}/admin/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_type: shopType }),
      });
      const data = await res.json();
      setTypeMsg(data.ok ? "Saved!" : (data.error ?? "Failed"));
    } catch {
      setTypeMsg("Failed");
    } finally {
      setSavingType(false);
      setTimeout(() => setTypeMsg(""), 3000);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <Section title="Shop Logo">
        <LogoUpload
          label="Shown on your booking page and admin portal"
          currentUrl={logoUrl}
          onUpload={handleLogoUpload}
          uploading={uploadingLogo}
        />
        {logoMsg && (
          <div style={{ marginTop: 10, fontSize: 13, color: logoMsg === "Logo updated!" ? "#4ade80" : "#f87171" }}>
            {logoMsg}
          </div>
        )}
      </Section>

      <Section title="Shop Type">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <select
              value={shopType}
              onChange={(e) => setShopType(e.target.value)}
              style={{ ...inputStyle, appearance: "none" }}
            >
              <option value="barbershop">Barbershop</option>
              <option value="beauty_salon">Beauty Salon</option>
              <option value="nail_salon">Nail Salon</option>
              <option value="spa">Spa</option>
              <option value="lash_studio">Lash Studio</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button
            onClick={saveShopType}
            disabled={savingType}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#d4af37",
              color: "#000",
              fontWeight: 800,
              fontSize: 14,
              cursor: savingType ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {savingType ? "Saving…" : "Save"}
          </button>
        </div>
        {typeMsg && (
          <div style={{ marginTop: 8, fontSize: 13, color: typeMsg === "Saved!" ? "#4ade80" : "#f87171" }}>
            {typeMsg}
          </div>
        )}
      </Section>
    </div>
  );
}
