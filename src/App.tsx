import { useEffect, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSettingsStore } from "@/stores/settingsStore";
import { useNotesStore } from "@/stores/notesStore";
import { useThemeStore } from "@/stores/themeStore";
import { useDeviceStore } from "@/stores/deviceStore";
import Layout from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage";
import MeetingDetailPage from "@/pages/MeetingDetailPage";
import DevicePage from "@/pages/DevicePage";
import SettingsPage from "@/pages/SettingsPage";
import SearchModal from "@/components/SearchModal";
import ImportWizard from "@/components/ImportWizard";

export default function App() {
  const loadSettings = useSettingsStore((s) => s.load);
  const loadNotes = useNotesStore((s) => s.loadNotes);
  const loadTheme = useThemeStore((s) => s.load);
  const initDevice = useDeviceStore((s) => s.init);
  const t = useThemeStore((s) => s.t);
  const [ready, setReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    Promise.all([loadSettings(), loadNotes(), loadTheme(), initDevice()]).finally(() =>
      setReady(true)
    );
  }, []);

  // Keyboard shortcut: Cmd+K to open search
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    },
    []
  );

  // Listen for custom events from sidebar / dashboard
  const handleOpenSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const handleOpenImport = useCallback(() => {
    setImportOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-search", handleOpenSearch);
    window.addEventListener("open-import", handleOpenImport);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-search", handleOpenSearch);
      window.removeEventListener("open-import", handleOpenImport);
    };
  }, [handleKeyDown, handleOpenSearch, handleOpenImport]);

  if (!ready) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: t.bg,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            className="animate-spin"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: `2px solid ${t.bd}`,
              borderTopColor: t.ac,
            }}
          />
          <p style={{ fontSize: 14, color: t.txM }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/meetings" replace />} />
          <Route path="/meetings" element={<DashboardPage />} />
          <Route path="/meetings/:id" element={<MeetingDetailPage />} />
          <Route path="/device" element={<DevicePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
