use tauri::Manager;

mod commands;
mod db;
mod usb;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::compute_md5,
            commands::save_recording,
            commands::get_app_data_dir,
            commands::usb_connect_and_scan,
            commands::usb_get_file,
            commands::usb_download_and_save,
            commands::usb_delete_file,
        ])
        .setup(|app| {
            // Ensure app data directory exists
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();
            std::fs::create_dir_all(app_data_dir.join("recordings")).ok();
            std::fs::create_dir_all(app_data_dir.join("transcripts")).ok();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
