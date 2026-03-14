import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface DeviceState {
  connected: boolean;
  model: string | null;

  /** Initialize: check current status + start listening for changes */
  init: () => Promise<void>;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  connected: false,
  model: null,

  init: async () => {
    // Get initial status
    try {
      const status = await invoke<{ connected: boolean; model: string | null }>(
        "check_usb_device"
      );
      set({ connected: status.connected, model: status.model });
    } catch {
      // Backend not available yet, stay disconnected
    }

    // Listen for live updates from the Rust watcher
    await listen<{ connected: boolean; model: string | null }>(
      "usb-device-status",
      (event) => {
        set({ connected: event.payload.connected, model: event.payload.model });
      }
    );
  },
}));
