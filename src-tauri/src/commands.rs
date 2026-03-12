use tauri::AppHandle;
use tauri::Manager;
use crate::usb::{UsbSession, UsbDeviceInfo, FileEntry};

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

/// Check whether a HiDock device is connected and return its basic info.
#[tauri::command]
pub async fn usb_get_device_info() -> Result<UsbDeviceInfo, String> {
    let mut session = UsbSession::open().await?;
    session.get_device_info().await
}

/// List all .hda / .wav files on the connected HiDock device.
#[tauri::command]
pub async fn usb_list_files() -> Result<Vec<FileEntry>, String> {
    let mut session = UsbSession::open().await?;
    session.list_files().await
}

/// Download a file from the connected HiDock device.
/// `length` must match the `size` field returned by `usb_list_files`.
#[tauri::command]
pub async fn usb_get_file(name: String, length: u32) -> Result<Vec<u8>, String> {
    let mut session = UsbSession::open().await?;
    session.get_file(&name, length).await
}

/// Delete a file from the connected HiDock device.
#[tauri::command]
pub async fn usb_delete_file(name: String) -> Result<String, String> {
    let mut session = UsbSession::open().await?;
    session.delete_file(&name).await
}
