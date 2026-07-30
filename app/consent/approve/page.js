"use client";
import { useEffect, useState } from "react";

const RATINGS = ["G", "PG", "PG-13", "R", "NC-17"];

export default function ApprovePage() {
  const [token, setToken] = useState(null);
  const [record, setRecord] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | done | error
  const [rating, setRating] = useState("PG");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);
    if (!t) {
      setStatus("error");
      return;
    }
    fetch(`/api/consent?token=${t}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.record) {
          setStatus("error");
          return;
        }
        setRecord(d.record);
        if (d.record.status === "approved") {
          setStatus("done");
        } else {
          setStatus("ready");
        }
      })
      .catch(() => setStatus("error"));
  }, []);

  async function approve() {
    setError("");
    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", token, maxRating: rating }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setStatus("done");
    } catch {
      setError("Something went wrong. Try again.");
    }
  }

  const wrap = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#17191E", color: "#F4F1EA", fontFamily: "sans-serif", padding: 24 };
  const card = { maxWidth: 420, width: "100%", background: "#1F2229", border: "1px solid #31353F", borderRadius: 16, padding: 24 };

  if (status === "loading") return <div style={wrap}>Loading…</div>;
  if (status === "error") {
    return (
      <div style={wrap}>
        <div style={card}>
          <p style={{ color: "#C1613B" }}>This consent link is invalid or has already been used.</p>
        </div>
      </div>
    );
  }
  if (status === "done") {
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={{ color: "#D9A441", fontSize: 22, marginBottom: 12 }}>All set</h1>
          <p>
            {record?.childName || "Your child"}'s account is approved
            {record?.approvedRating ? ` for ${record.approvedRating} and under` : ""}. A confirmation email has been sent to you.
          </p>
          <p style={{ fontSize: 13, color: "#9A9EA8", marginTop: 12 }}>
            You can adjust this rating limit any time from the Family tab in the app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={{ color: "#D9A441", fontSize: 22, marginBottom: 12 }}>Parent/guardian approval</h1>
        <p style={{ marginBottom: 16 }}>
          <strong>{record?.childName}</strong> ({record?.childEmail}) wants to use Family Movie Match and listed you as
          their parent or guardian. Until approved, their account only shows G-rated titles and no additional personal
          information is collected from them.
        </p>
        <p style={{ fontSize: 13, color: "#9A9EA8", marginBottom: 8 }}>Choose the content rating limit to allow:</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {RATINGS.map((r) => (
            <button
              key={r}
              onClick={() => setRating(r)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "2px solid " + (rating === r ? "#D9A441" : "#31353F"),
                background: rating === r ? "#D9A441" : "transparent",
                color: rating === r ? "#231C12" : "#F4F1EA",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {r}
            </button>
          ))}
        </div>
        {error && <p style={{ color: "#C1613B", marginBottom: 12 }}>{error}</p>}
        <button
          onClick={approve}
          style={{ width: "100%", padding: "12px", borderRadius: 10, background: "#D9A441", color: "#231C12", fontWeight: 800, border: "none", cursor: "pointer", fontSize: 15 }}
        >
          Approve for {rating} and under
        </button>
      </div>
    </div>
  );
}
