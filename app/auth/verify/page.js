"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

export default function VerifyPage() {
  const [status, setStatus] = useState("verifying"); // verifying | error

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      return;
    }
    signIn("email-link", { token, redirect: true, callbackUrl: "/" }).catch(() => setStatus("error"));
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#17191E", color: "#D9A441", fontFamily: "sans-serif", textAlign: "center", padding: 24 }}>
      {status === "verifying" ? (
        <p>Signing you in…</p>
      ) : (
        <p style={{ color: "#C1613B" }}>
          That link is invalid or has expired. Head back and request a new one.
        </p>
      )}
    </div>
  );
}
