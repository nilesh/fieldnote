use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;
use crate::usb::{UsbSession, UsbDeviceInfo, FileEntry};

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
