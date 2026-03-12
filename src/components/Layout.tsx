import { Outlet, NavLink } from "react-router-dom";
import { FileText, Usb, Settings, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotesStore } from "@/stores/notesStore";

const nav = [
  { to: "/notes", icon: FileText, label: "Notes" },
  { to: "/device", icon: Usb, label: "Device" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Layout() {
  const notes = useNotesStore((s) => s.notes);
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex w-16 flex-col items-center border-r border-border bg-card py-4 gap-1">
        {/* Logo */}
        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Mic className="h-5 w-5 text-primary" />
        </div>

        {/* Nav */}
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              cn(
                "relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )
            }
          >
            <Icon className="h-5 w-5" />
          </NavLink>
        ))}

        {/* Bottom: notes count */}
        <div className="mt-auto text-center">
          <span className="text-[10px] text-muted-foreground">{notes.length}</span>
          <p className="text-[9px] text-muted-foreground">notes</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
