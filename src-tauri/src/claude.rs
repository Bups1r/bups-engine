use std::process::Stdio;
use std::path::PathBuf;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tauri::Window;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Find the Claude CLI executable
fn find_claude_executable() -> Option<PathBuf> {
    // Try common installation locations on Windows
    if let Ok(appdata) = std::env::var("APPDATA") {
        // npm global install location
        let npm_path = PathBuf::from(&appdata).join("npm").join("claude.cmd");
        if npm_path.exists() {
            return Some(npm_path);
        }
    }

    if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
        // Possible standalone install location
        let local_path = PathBuf::from(&localappdata).join("Programs").join("claude").join("claude.exe");
        if local_path.exists() {
            return Some(local_path);
        }
    }

    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        // npm global install in user profile
        let user_npm = PathBuf::from(&userprofile).join("AppData").join("Roaming").join("npm").join("claude.cmd");
        if user_npm.exists() {
            return Some(user_npm);
        }
    }

    // Fall back to hoping it's in PATH
    None
}

/// Send a message to Claude CLI and get the response
pub async fn send_message_to_claude(message: &str) -> Result<String, String> {
    let claude_path = find_claude_executable();
    let mut cmd = match &claude_path {
        Some(path) => Command::new(path),
        None => Command::new("claude"),
    };

    // Use print mode for single-shot queries
    cmd.arg("--print");
    cmd.arg(message);

    // Configure process
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Spawn and wait for output
    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to spawn Claude CLI: {}. Make sure 'claude' is in your PATH.", e))?;

    if output.status.success() {
        let response = String::from_utf8_lossy(&output.stdout).to_string();
        if response.is_empty() {
            // Try stderr if stdout is empty
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            if !stderr.is_empty() {
                return Ok(stderr);
            }
            return Ok("Command completed successfully.".to_string());
        }
        Ok(response)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Claude CLI error: {}", stderr))
    }
}

/// Stream a message to Claude CLI and emit chunks via Tauri events
pub async fn stream_message_to_claude(
    window: Window,
    message: String,
    cancel_flag: Arc<Mutex<bool>>,
) -> Result<String, String> {
    let claude_path = find_claude_executable();
    let mut cmd = match &claude_path {
        Some(path) => Command::new(path),
        None => Command::new("claude"),
    };

    // Use print mode for streaming
    cmd.arg("--print");
    cmd.arg(&message);

    // Configure process
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Spawn the process
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn Claude CLI: {}. Make sure 'claude' is in your PATH.", e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;

    let mut reader = BufReader::new(stdout).lines();
    let mut full_response = String::new();

    // Read output line by line
    while let Some(line) = reader.next_line().await.map_err(|e| e.to_string())? {
        // Check if generation should be cancelled
        if *cancel_flag.lock().await {
            let _ = child.kill().await;
            window
                .emit("claude-stream-cancelled", ())
                .map_err(|e| format!("Failed to emit cancel event: {}", e))?;
            return Err("Generation cancelled by user".to_string());
        }

        // Emit the line as a chunk
        window
            .emit("claude-stream-chunk", &line)
            .map_err(|e| format!("Failed to emit stream chunk: {}", e))?;

        full_response.push_str(&line);
        full_response.push('\n');
    }

    // Wait for the process to complete
    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for Claude process: {}", e))?;

    if status.success() {
        window
            .emit("claude-stream-complete", &full_response)
            .map_err(|e| format!("Failed to emit completion event: {}", e))?;
        Ok(full_response)
    } else {
        let stderr = if let Some(mut stderr) = child.stderr {
            use tokio::io::AsyncReadExt;
            let mut buf = String::new();
            stderr.read_to_string(&mut buf).await.unwrap_or_default();
            buf
        } else {
            String::new()
        };

        window
            .emit("claude-stream-error", &stderr)
            .map_err(|e| format!("Failed to emit error event: {}", e))?;

        Err(format!("Claude CLI error: {}", stderr))
    }
}
