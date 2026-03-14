import { create } from "zustand";
import { Store } from "@tauri-apps/plugin-store";
import { lightTheme, darkTheme, type Theme } from "@/lib/theme";

let _store: Store | null = null;

async function getStore() {
  if (!_store) _store = await Store.load("settings.json");
  return _store;
}

interface ThemeState {
  dark: boolean;
  t: Theme;
  toggle: () => void;
  load: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  dark: false,
  t: lightTheme,

  toggle: () => {
    const next = !get().dark;
    set({ dark: next, t: next ? darkTheme : lightTheme });
    document.documentElement.classList.toggle("dark", next);
    getStore().then((s) => { s.set("darkMode", next); s.save(); });
  },

  load: async () => {
    const store = await getStore();
    const dark = (await store.get<boolean>("darkMode")) ?? false;
    set({ dark, t: dark ? darkTheme : lightTheme });
    document.documentElement.classList.toggle("dark", dark);
  },
}));
