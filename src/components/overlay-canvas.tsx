"use client";

import { useEffect, useRef, useState } from "react";

type Snapshot = {
  session: { username: string; status: string };
  events: Array<{
    id: number;
    type: string;
    nickname: string;
    username: string;
    giftName: string;
    diamondCount: number;
    repeatCount: number;
    comment: string;
    createdAt: string;
  }>;
  leaderboard: Array<{ username: string; nickname: string; diamonds: number; gifts: number }>;
  overview: { viewers: number; diamonds: number; gifts: number; followers: number; comments: number; durationMin: number };
};

const ACCENTS: Record<string, { main: string; soft: string }> = {
  cyan: { main: "#25f4ee", soft: "rgba(37,244,238,0.16)" },
  pink: { main: "#fe2c55", soft: "rgba(254,44,85,0.16)" },
  violet: { main: "#8b5cf6", soft: "rgba(139,92,246,0.18)" },
  amber: { main: "#f5b642", soft: "rgba(245,182,66,0.16)" },
};

function num(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  return new Intl.NumberFormat("tr-TR").format(value);
}

export function OverlayCanvas({
  kind,
  username,
  goal,
  accent,
  name,
}: {
  kind: string;
  username: string;
  goal: number;
  accent: string;
  name: string;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const colors = ACCENTS[accent] ?? ACCENTS.cyan;

  useEffect(() => {
    const previous = document.body.style.background;
    document.body.style.background = "transparent";
    return () => {
      document.body.style.background = previous;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const response = await fetch(`/api/live/feed?username=${encodeURIComponent(username)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Feed alınamadı");
        const data = (await response.json()) as Snapshot;
        if (active) {
          setSnapshot(data);
          setError("");
        }
      } catch (fetchError) {
        if (active) setError((fetchError as Error).message);
      }
    };
    void tick();
    timerRef.current = setInterval(tick, 2800);
    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [username]);

  const cardStyle: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.16)",
    background: "linear-gradient(160deg, rgba(10,11,20,0.94), rgba(5,6,10,0.9))",
    borderRadius: 18,
    padding: "14px 16px",
    backdropFilter: "blur(14px)",
    boxShadow: "0 20px 50px -24px rgba(0,0,0,0.95)",
    color: "#f2f3fb",
    fontFamily: "Inter, 'Segoe UI', system-ui, sans-serif",
    minWidth: 250,
    maxWidth: 380,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "rgba(242,243,251,0.5)",
    fontWeight: 700,
  };

  const livePill = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.08em",
        background: "rgba(254,44,85,0.16)",
        border: "1px solid rgba(254,44,85,0.4)",
        padding: "3px 8px",
        borderRadius: 999,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 99, background: "#fe2c55" }} /> LIVE
    </span>
  );

  if (kind === "goal") {
    const value = snapshot?.overview.diamonds ?? 0;
    const percent = Math.max(0, Math.min(100, Math.round((value / Math.max(goal, 1)) * 100)));
    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={labelStyle}>{name || "Elmas Hedefi"}</span>
          {livePill}
        </div>
        <p style={{ fontSize: 27, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
          {num(value)}{" "}
          <span style={{ fontSize: 12, color: "rgba(242,243,251,0.4)", fontWeight: 500 }}>/ {num(goal)}</span>
        </p>
        <div style={{ height: 9, borderRadius: 99, background: "rgba(255,255,255,0.1)", margin: "10px 0 6px", overflow: "hidden" }}>
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              borderRadius: 99,
              background: `linear-gradient(90deg, ${colors.main}, #8b5cf6, #fe2c55)`,
              transition: "width 0.6s ease",
            }}
          />
        </div>
        <p style={{ fontSize: 11, color: "rgba(242,243,251,0.45)", margin: 0 }}>
          %{percent} tamamlandı · {snapshot?.overview.viewers ?? 0} izleyici
        </p>
      </div>
    );
  }

  if (kind === "top-gifter") {
    const rows = (snapshot?.leaderboard ?? []).slice(0, 5);
    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={labelStyle}>Top Gifters</span>
          <span style={{ ...labelStyle, fontSize: 9, letterSpacing: "0.06em" }}>@{snapshot?.session.username ?? username}</span>
        </div>
        {rows.length === 0 ? (
          <p style={{ fontSize: 11, color: "rgba(242,243,251,0.4)", margin: 0 }}>Hediye bekleniyor...</p>
        ) : (
          rows.map((row, index) => (
            <div
              key={`${row.username}-${index}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
                borderBottom: index === rows.length - 1 ? "none" : "1px solid rgba(255,255,255,0.06)",
                fontSize: 12.5,
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 7,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 10,
                  fontWeight: 800,
                  background: index === 0 ? `linear-gradient(135deg, ${colors.main}, #8b5cf6)` : "rgba(255,255,255,0.08)",
                  color: index === 0 ? "#05060a" : "rgba(255,255,255,0.65)",
                }}
              >
                {index + 1}
              </span>
              <span style={{ flex: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.nickname || row.username}
              </span>
              <span style={{ fontWeight: 800, color: "#9df9f5", fontSize: 11.5 }}>{num(row.diamonds)} 💎</span>
            </div>
          ))
        )}
      </div>
    );
  }

  if (kind === "chat") {
    const events = (snapshot?.events ?? [])
      .filter((event) => ["comment", "bot", "gift"].includes(event.type))
      .slice(0, 7)
      .reverse();
    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={labelStyle}>Canlı Sohbet</span>
          {livePill}
        </div>
        {events.length === 0 ? (
          <p style={{ fontSize: 11, color: "rgba(242,243,251,0.4)", margin: 0 }}>Sohbet akışı bekleniyor...</p>
        ) : (
          events.map((event) => (
            <p key={event.id} style={{ fontSize: 12, lineHeight: 1.5, margin: "3px 0", color: event.type === "bot" ? "#c4b5fd" : "rgba(242,243,251,0.85)" }}>
              {event.type === "gift" ? (
                <>🎁 <b style={{ color: "#ffb3c2" }}>{event.nickname || event.username}</b> {event.giftName} × {event.repeatCount}</>
              ) : (
                <><b style={{ color: "#9df9f5" }}>{event.nickname || event.username}:</b> {event.comment}</>
              )}
            </p>
          ))
        )}
      </div>
    );
  }

  if (kind === "alert") {
    const gift =
      (snapshot?.events ?? []).find(
        (event) => event.type === "gift" && event.diamondCount * (event.repeatCount || 1) >= 100,
      ) ?? (snapshot?.events ?? []).find((event) => event.type === "gift");
    if (!gift) {
      return (
        <div style={cardStyle}>
          <span style={labelStyle}>Hediye Alarmı</span>
          <p style={{ fontSize: 11.5, color: "rgba(242,243,251,0.45)", margin: "6px 0 0" }}>Büyük hediye bekleniyor...</p>
        </div>
      );
    }
    return (
      <div
        style={{
          ...cardStyle,
          border: "1px solid rgba(254,44,85,0.45)",
          background: "linear-gradient(140deg, rgba(254,44,85,0.24), rgba(124,58,237,0.18))",
          animation: "feed-in 0.4s ease both",
        }}
      >
        <span style={labelStyle}>Hediye Alarmı</span>
        <p style={{ fontSize: 16, fontWeight: 800, margin: "6px 0 2px" }}>
          {gift.nickname || gift.username} → {gift.giftName}
        </p>
        <p style={{ fontSize: 11.5, color: "rgba(242,243,251,0.6)", margin: 0 }}>
          {num(gift.diamondCount * (gift.repeatCount || 1))} elmas · {gift.repeatCount} adet
        </p>
      </div>
    );
  }

  const stats: Array<[string, number]> = [
    ["İzleyici", snapshot?.overview.viewers ?? 0],
    ["Elmas", snapshot?.overview.diamonds ?? 0],
    ["Hediye", snapshot?.overview.gifts ?? 0],
    ["Takipçi", snapshot?.overview.followers ?? 0],
  ];
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={labelStyle}>Yayın Metrikleri</span>
        {livePill}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        {stats.map(([label, value]) => (
          <div key={label} style={{ border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "7px 9px", background: "rgba(255,255,255,0.03)" }}>
            <p style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{num(value)}</p>
            <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(242,243,251,0.4)", margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>
      {error ? <p style={{ fontSize: 10, color: "#ff9eb2", marginTop: 6 }}>{error}</p> : null}
    </div>
  );
}
