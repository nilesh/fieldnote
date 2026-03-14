use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;
use tauri::Manager;
use tauri::Emitter;
use crate::usb::{self, UsbSession, UsbDeviceInfo, FileEntry};

/// Global USB session — kept alive so we don't have to re-claim the interface
/// (which races with accessoryd on macOS) for every operation.
static USB_SESSION: Mutex<Option<UsbSession>> = Mutex::new(None);

fn with_session<T>(mut f: impl FnMut(&mut UsbSession) -> Result<T, String>) -> Result<T, String> {
    let mut guard = USB_SESSION.lock().map_err(|e| e.to_string())?;
    // Try existing session first
    if let Some(ref mut session) = *guard {
        match f(session) {
            Ok(val) => return Ok(val),
            Err(_) => {
                // Session went stale, drop it and re-open below
                *guard = None;
            }
        }
    }
    // Open fresh session
    let mut session = UsbSession::open()?;
    let result = f(&mut session);
    if result.is_ok() {
        *guard = Some(session);
    }
    result
}

/// Compute MD5 hash of a byte array (used to generate device file signatures)
#[tauri::command]
pub fn compute_md5(data: Vec<u8>) -> String {
    format!("{:x}", md5::compute(&data))
}

/// Save a recording buffer to the local recordings directory
/// Returns the saved file path
#[tauri::command]
pub async fn save_recording(
    app: AppHandle,
    filename: String,
    data: Vec<u8>,
) -> Result<String, String> {
    let recordings_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("recordings");

    std::fs::create_dir_all(&recordings_dir).map_err(|e| e.to_string())?;

    let file_path = recordings_dir.join(&filename);
    std::fs::write(&file_path, &data).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Get the app data directory path (exposed to frontend)
#[tauri::command]
pub fn get_app_data_dir(app: AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// Convert an .hda recording to .mp3 using ffmpeg with volume normalization.
/// HiDock recordings are very quiet (~-66dB); loudnorm boosts them for Whisper.
/// Returns the path to the converted .mp3 file.
#[tauri::command]
pub async fn convert_hda_to_mp3(file_path: String) -> Result<String, String> {
    let input = std::path::PathBuf::from(&file_path);
    let output = input.with_extension("mp3");

    // Skip if already converted
    if output.exists() {
        return Ok(output.to_string_lossy().to_string());
    }

    let status = tokio::process::Command::new("ffmpeg")
        .args([
            "-i", &file_path,
            "-y",
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ar", "16000",
            "-ac", "1",
            "-b:a", "48k",
        ])
        .arg(output.as_os_str())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {e}. Is ffmpeg installed?"))?;

    if !status.success() {
        return Err(format!("ffmpeg exited with code {}", status.code().unwrap_or(-1)));
    }

    Ok(output.to_string_lossy().to_string())
}

// ─── USB commands ─────────────────────────────────────────────────────────────

/// Connect to the device and return info + file list in a single session.
#[tauri::command]
pub async fn usb_connect_and_scan() -> Result<(UsbDeviceInfo, Vec<FileEntry>), String> {
    tokio::task::spawn_blocking(|| {
        with_session(|s| {
            let info = s.get_device_info()?;
            let files = s.list_files()?;
            Ok((info, files))
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Download a file from the connected HiDock device.
#[tauri::command]
pub async fn usb_get_file(name: String, length: u32) -> Result<Vec<u8>, String> {
    tokio::task::spawn_blocking(move || {
        with_session(|s| s.get_file(&name, length))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Download a file from USB and save it directly to disk.
/// Returns the saved file path. Avoids sending large byte arrays over IPC.
#[tauri::command]
pub async fn usb_download_and_save(
    app: AppHandle,
    name: String,
    length: u32,
) -> Result<String, String> {
    let filename = name.clone();
    let data = tokio::task::spawn_blocking(move || {
        with_session(|s| s.get_file(&name, length))
    })
    .await
    .map_err(|e| e.to_string())??;

    let recordings_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("recordings");

    std::fs::create_dir_all(&recordings_dir).map_err(|e| e.to_string())?;

    let file_path = recordings_dir.join(&filename);
    std::fs::write(&file_path, &data).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Delete a file from the connected HiDock device.
#[tauri::command]
pub async fn usb_delete_file(name: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        with_session(|s| s.delete_file(&name))
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── USB device presence check ───────────────────────────────────────────────

/// One-shot check: is a HiDock device currently on the USB bus?
/// Returns { connected: bool, model: Option<String> }
#[tauri::command]
pub fn check_usb_device() -> serde_json::Value {
    match usb::find_hidock_device() {
        Some((model, _, _)) => serde_json::json!({ "connected": true, "model": model }),
        None => serde_json::json!({ "connected": false, "model": null }),
    }
}

// ─── USB hotplug watcher ─────────────────────────────────────────────────────

static WATCHER_RUNNING: AtomicBool = AtomicBool::new(false);

/// Start a background thread that polls USB presence every 2 seconds
/// and emits "usb-device-status" events when the state changes.
pub fn start_usb_watcher(app: AppHandle) {
    if WATCHER_RUNNING.swap(true, Ordering::SeqCst) {
        return; // already running
    }

    std::thread::spawn(move || {
        let mut was_connected = false;
        let mut last_model = String::new();

        loop {
            let current = usb::find_hidock_device();
            let is_connected = current.is_some();
            let model = current.as_ref().map(|(m, _, _)| m.clone()).unwrap_or_default();

            if is_connected != was_connected || (is_connected && model != last_model) {
                let payload = if is_connected {
                    serde_json::json!({ "connected": true, "model": model })
                } else {
                    // Device was unplugged — drop the cached session
                    if let Ok(mut guard) = USB_SESSION.lock() {
                        *guard = None;
                    }
                    serde_json::json!({ "connected": false, "model": null })
                };

                let _ = app.emit("usb-device-status", payload);
                was_connected = is_connected;
                last_model = model;
            }

            std::thread::sleep(std::time::Duration::from_secs(2));
        }
    });
}
