import { create } from "zustand";
import { Store } from "@tauri-apps/plugin-store";
import type { AppSettings } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

let _store: Store | null = null;

async function getStore() {
  if (!_store) {
    _store = await Store.load("settings.json");
  }
  return _store;
}

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  save: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const store = await getStore();
    const saved = await store.get<Partial<AppSettings>>("settings");
    set({
      settings: { ...DEFAULT_SETTINGS, ...(saved ?? {}) },
      loaded: true,
    });
  },

  save: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    const store = await getStore();
    await store.set("settings", next);
    await store.save();
  },
}));
