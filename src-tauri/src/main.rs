#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod claude;

use claude::{send_message_to_claude, stream_message_to_claude};
use std::sync::Arc;
use tauri::{Manager, State, Window};
use tokio::sync::Mutex;

// Global state for cancellation
struct CancelState {
    flag: Arc<Mutex<bool>>,
}

#[tauri::command]
async fn send_to_claude(message: String) -> Result<String, String> {
    send_message_to_claude(&message).await
}

#[tauri::command]
async fn stream_to_claude(
    window: Window,
    message: String,
    cancel_state: State<'_, Arc<Mutex<CancelState>>>,
) -> Result<String, String> {
    // Reset cancel flag
    let cancel_flag = {
        let mut state = cancel_state.lock().await;
        *state.flag.lock().await = false;
        Arc::clone(&state.flag)
    };

    stream_message_to_claude(window, message, cancel_flag).await
}

#[tauri::command]
async fn cancel_stream(cancel_state: State<'_, Arc<Mutex<CancelState>>>) -> Result<(), String> {
    let state = cancel_state.lock().await;
    *state.flag.lock().await = true;
    Ok(())
}

#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = std::path::Path::new(&path).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
async fn list_directory(path: String) -> Result<Vec<String>, String> {
    let mut entries = tokio::fs::read_dir(&path)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut files = Vec::new();
    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        files.push(entry.path().display().to_string());
    }
    Ok(files)
}

#[tauri::command]
async fn create_directory(path: String) -> Result<(), String> {
    tokio::fs::create_dir_all(&path)
        .await
        .map_err(|e| format!("Failed to create directory: {}", e))
}

#[tauri::command]
async fn file_exists(path: String) -> Result<bool, String> {
    Ok(tokio::fs::metadata(&path).await.is_ok())
}

fn main() {
    let cancel_state = Arc::new(Mutex::new(CancelState {
        flag: Arc::new(Mutex::new(false)),
    }));

    tauri::Builder::default()
        .manage(cancel_state)
        .invoke_handler(tauri::generate_handler![
            send_to_claude,
            stream_to_claude,
            cancel_stream,
            read_file,
            write_file,
            list_directory,
            create_directory,
            file_exists
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
