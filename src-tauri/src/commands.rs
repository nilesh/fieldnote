use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

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
