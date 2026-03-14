import { Outlet, NavLink } from "react-router-dom";
import { Home, Mic, HardDrive, Settings, Search, Sun, Moon, Usb } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";

const nav = [
  { to: "/meetings", icon: Home, label: "Meetings" },
  { to: "/device", icon: HardDrive, label: "Device" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Layout() {
  const { t, dark, toggle } = useThemeStore();

  // Gradient backgrounds inspired by MP020 reference images
  const sidebarBg = dark
    ? "linear-gradient(180deg, #141a1f 0%, #1a2028 60%, #1d242c 100%)"
    : "linear-gradient(180deg, #E4E3DC 0%, #ddd8cc 50%, #d8d2c4 100%)";

  const mainBg = dark
    ? "linear-gradient(170deg, #1F282E 0%, #232d34 50%, #262f36 100%)"
    : "linear-gradient(170deg, #DAD8CF 0%, #d7d4ca 50%, #d4d0c4 100%)";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: t.bg }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 230,
          minWidth: 230,
          display: "flex",
          flexDirection: "column",
          background: sidebarBg,
          borderRight: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
          padding: "16px 12px 12px",
          userSelect: "none",
        }}
      >
        {/* Logo + branding */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px", marginBottom: 20 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: dark
                ? "linear-gradient(135deg, #FF4E20 0%, #ff6a3d 100%)"
                : "linear-gradient(135deg, #B83312 0%, #d63b15 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: dark
                ? "0 2px 8px rgba(255,78,32,0.3)"
                : "0 2px 8px rgba(184,51,18,0.25)",
            }}
          >
            <Mic size={17} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.txSA, lineHeight: 1.2 }}>FieldNote</div>
            <div style={{ fontSize: 10, color: t.txS, lineHeight: 1.3, opacity: 0.8 }}>Hidock P1 Edition</div>
          </div>
        </div>

        {/* Search bar */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-search"))}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "7px 10px",
            borderRadius: 6,
            border: "none",
            background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
            color: t.txS,
            fontSize: 13,
            cursor: "pointer",
            marginBottom: 16,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = dark
              ? "rgba(255,255,255,0.1)"
              : "rgba(0,0,0,0.09)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = dark
              ? "rgba(255,255,255,0.06)"
              : "rgba(0,0,0,0.05)";
          }}
        >
          <Search size={14} />
          <span style={{ flex: 1, textAlign: "left" }}>Search</span>
          <span style={{ fontSize: 11, opacity: 0.6 }}>{"\u2318"}K</span>
        </button>

        {/* Navigation */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                textDecoration: "none",
                color: isActive ? t.txSA : t.txS,
                background: isActive
                  ? dark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.07)"
                  : "transparent",
                transition: "background 0.15s, color 0.15s",
              })}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                if (!el.classList.contains("active")) {
                  el.style.background = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                if (!el.classList.contains("active")) {
                  el.style.background = "transparent";
                }
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Device status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 6,
            fontSize: 13,
            color: t.txS,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: t.ok,
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1 }}>Hidock P1</span>
          <Usb size={14} style={{ opacity: 0.6 }} />
        </div>

        {/* Dark/light toggle */}
        <button
          onClick={toggle}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
            padding: "7px 10px",
            borderRadius: 6,
            border: "none",
            background: "transparent",
            color: t.txS,
            fontSize: 13,
            cursor: "pointer",
            marginTop: 4,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = dark
              ? "rgba(255,255,255,0.06)"
              : "rgba(0,0,0,0.04)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
          <span>{dark ? "Light mode" : "Dark mode"}</span>
        </button>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          overflow: "auto",
          background: mainBg,
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            padding: "24px 32px",
          }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
