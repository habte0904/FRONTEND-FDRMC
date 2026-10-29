import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { emergencyContactService, type EmergencyContact } from "@/api/emergencyContactService";

const SESSION_KEY = "emergencyPopupSeen";

export type PopupConfig = {
  enabled?: boolean;
  title?: string;
  message?: string;
  contactId?: string;
  contact?: EmergencyContact | null;
};

export interface EmergencyPopupProps {
  config: PopupConfig | undefined | null;
  forceOpen?: boolean;
  onClosePreview?: () => void;
}

export const EmergencyPopup: React.FC<EmergencyPopupProps> = ({
  config,
  forceOpen = false,
  onClosePreview,
}) => {
  const [visible, setVisible] = useState(false);
  const [contact, setContact] = useState<EmergencyContact | null>(config?.contact || null);
  const [animatingOut, setAnimatingOut] = useState(false);

  useEffect(() => {
    // If opened in admin preview mode
    if (forceOpen) {
      if (config?.contact) {
        setContact(config.contact);
        setVisible(true);
      } else if (config?.contactId) {
        emergencyContactService
          .getPublicDirectory()
          .then((res) => {
            const found = (res.contacts || []).find(
              (c) => String(c._id) === String(config.contactId)
            );
            if (found) setContact(found);
            setVisible(true);
          })
          .catch(() => {
            setVisible(true);
          });
      } else {
        setVisible(true);
      }
      return;
    }

    // Only proceed if enabled
    if (!config?.enabled) {
      setVisible(false);
      return;
    }

    // Check session storage, allowing ?popup=true or ?emergency=true in URL to override for testing
    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const forceByUrl = urlParams?.has("popup") || urlParams?.has("emergency") || urlParams?.has("emergency_popup");
    if (!forceByUrl && sessionStorage.getItem(SESSION_KEY)) {
      return;
    }

    // If backend already attached the resolved contact
    if (config.contact) {
      setContact(config.contact);
      setVisible(true);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const res = await emergencyContactService.getPublicDirectory();
        if (cancelled) return;
        const contacts = res.contacts || [];
        const found = config.contactId
          ? contacts.find((c) => String(c._id) === String(config.contactId) && c.isActive)
          : contacts.find((c) => c.isActive);

        if (found) {
          setContact(found);
          setVisible(true);
        } else if (config.enabled) {
          // Fallback if no contact list returned yet
          setVisible(true);
        }
      } catch {
        // Fallback display if network fails
        if (config.enabled) {
          setVisible(true);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [config?.enabled, config?.contactId, config?.contact, forceOpen]);

  const close = useCallback(() => {
    setAnimatingOut(true);
    if (!forceOpen) {
      sessionStorage.setItem(SESSION_KEY, "1");
    }
    setTimeout(() => {
      setVisible(false);
      setAnimatingOut(false);
      onClosePreview?.();
    }, 320);
  }, [forceOpen, onClosePreview]);

  // Close on Escape key
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, close]);

  if (!visible) return null;

  const title = config?.title?.trim() || "Emergency Hotline";
  const message = config?.message?.trim() || "";
  const phoneNumber = contact?.phoneNumber || "939";
  const contactTitle = contact?.title || "Emergency Response";
  const alternateNumber = contact?.alternatePhoneNumber;

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        backgroundColor: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        animation: animatingOut
          ? "epFadeOut 0.32s ease forwards"
          : "epFadeIn 0.28s ease",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <style>{`
        @keyframes epFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes epFadeOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes epSlideUp {
          from { opacity: 0; transform: translateY(28px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes epSlideDown {
          from { opacity: 1; transform: translateY(0)    scale(1);    }
          to   { opacity: 0; transform: translateY(28px) scale(0.96); }
        }
        @keyframes epPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.5); }
          50%       { box-shadow: 0 0 0 14px rgba(220,38,38,0); }
        }
        @keyframes epRing {
          0%,100% { transform: rotate(0deg); }
          15%      { transform: rotate(-18deg); }
          30%      { transform: rotate(18deg); }
          45%      { transform: rotate(-14deg); }
          60%      { transform: rotate(14deg); }
          75%      { transform: rotate(-8deg); }
          90%      { transform: rotate(8deg); }
        }
      `}</style>

      {/* Card */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "420px",
          borderRadius: "24px",
          background: "#fff",
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          overflow: "hidden",
          animation: animatingOut
            ? "epSlideDown 0.32s ease forwards"
            : "epSlideUp 0.32s ease",
        }}
      >
        {/* Red top accent stripe */}
        <div style={{ height: "6px", background: "linear-gradient(90deg, #dc2626, #ef4444, #f97316)" }} />

        {/* Close button */}
        <button
          onClick={close}
          aria-label="Close popup"
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: "none",
            background: "#f1f5f9",
            color: "#64748b",
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            transition: "background 0.15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#e2e8f0")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#f1f5f9")}
        >
          ×
        </button>

        {/* Body */}
        <div style={{ padding: "32px 32px 28px" }}>
          {/* Icon + title */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#fef2f2",
                animation: "epPulse 2s infinite, epRing 3s 0.8s ease-in-out infinite",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: "28px", lineHeight: 1 }}>🚨</span>
            </div>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#dc2626", marginBottom: "2px" }}>
                Emergency Alert
              </p>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0f172a", lineHeight: 1.25 }}>
                {title}
              </h2>
            </div>
          </div>

          {/* Phone number — main CTA */}
          <a
            href={`tel:${phoneNumber}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              width: "100%",
              padding: "16px 20px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #dc2626, #b91c1c)",
              color: "#fff",
              textDecoration: "none",
              marginBottom: "16px",
              boxShadow: "0 4px 20px rgba(220,38,38,0.35)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 8px 28px rgba(220,38,38,0.45)";
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.transform = "";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 20px rgba(220,38,38,0.35)";
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "12px", opacity: 0.9, fontWeight: 600, marginBottom: "2px" }}>
                {contactTitle}
              </p>
              <p style={{ margin: 0, fontSize: "30px", fontWeight: 900, letterSpacing: "0.03em", lineHeight: 1 }}>
                {phoneNumber}
              </p>
              {contact?.availabilityText && (
                <p style={{ margin: "4px 0 0", fontSize: "11px", opacity: 0.85 }}>
                  {contact.availabilityText}
                </p>
              )}
            </div>
            <span style={{ fontSize: "28px", opacity: 0.9 }}>📞</span>
          </a>

          {/* Alternate number (if any) */}
          {alternateNumber && (
            <a
              href={`tel:${alternateNumber}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 16px",
                borderRadius: "12px",
                border: "1.5px solid #fecaca",
                background: "#fef2f2",
                color: "#dc2626",
                textDecoration: "none",
                fontSize: "15px",
                fontWeight: 700,
                marginBottom: "16px",
                transition: "background 0.15s",
              }}
              onMouseOver={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "#fee2e2")}
              onMouseOut={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "#fef2f2")}
            >
              <span style={{ fontSize: "16px" }}>📱</span>
              <span>Alternate: {alternateNumber}</span>
            </a>
          )}

          {/* Optional message */}
          {message && (
            <p style={{ margin: "0 0 18px", fontSize: "14px", color: "#475569", lineHeight: 1.6 }}>
              {message}
            </p>
          )}

          {/* Footer row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <Link
              to="/emergency-contacts"
              onClick={close}
              style={{ fontSize: "13px", color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
              onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "underline")}
              onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "none")}
            >
              View full directory →
            </Link>
            <button
              onClick={close}
              style={{
                padding: "8px 20px",
                borderRadius: "10px",
                border: "1.5px solid #e2e8f0",
                background: "#fff",
                color: "#64748b",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#fff")}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyPopup;
