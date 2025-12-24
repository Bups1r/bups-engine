use std::process::Stdio;
use std::path::PathBuf;
use tauri::Window;
use std::sync::Arc;
use std::sync::atomic::Ordering;

// Import CancelState from main
use crate::CancelState;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Find the Claude CLI - returns (node_path, script_path) or None
fn find_claude_cli() -> Option<(PathBuf, PathBuf)> {
    // Look for the npm-installed Claude CLI script
    if let Ok(appdata) = std::env::var("APPDATA") {
        let npm_dir = PathBuf::from(&appdata).join("npm");
        let script_path = npm_dir
            .join("node_modules")
            .join("@anthropic-ai")
            .join("claude-code")
            .join("cli.js");

        if script_path.exists() {
            // Find node.exe
            let node_in_npm = npm_dir.join("node.exe");
            if node_in_npm.exists() {
                return Some((node_in_npm, script_path));
            }

            // Try to find node in Program Files
            if let Ok(programfiles) = std::env::var("ProgramFiles") {
                let node_path = PathBuf::from(&programfiles).join("nodejs").join("node.exe");
                if node_path.exists() {
                    return Some((node_path, script_path));
                }
            }

            // Fall back to node in PATH
            return Some((PathBuf::from("node"), script_path));
        }
    }

    None
}

/// Send a message to Claude CLI and get the response (blocking, run in spawn_blocking)
pub async fn send_message_to_claude(message: &str) -> Result<String, String> {
    use std::process::Command as StdCommand;
    #[cfg(windows)]
    use std::os::windows::process::CommandExt;

    let claude_cli = find_claude_cli();
    let message = message.to_string();

    // Run blocking command in a separate thread
    let result = tokio::task::spawn_blocking(move || {
        let mut cmd;

        match claude_cli {
            Some((node_path, script_path)) => {
                cmd = StdCommand::new(&node_path);
                cmd.arg(&script_path);
            }
            None => {
                return Err("Claude CLI not found. Please install it with: npm install -g @anthropic-ai/claude-code".to_string());
            }
        }

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        cmd.arg("--print");
        cmd.arg(&message);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let output = cmd.output().map_err(|e| {
            format!("Failed to spawn Claude CLI: {}. Make sure node is installed.", e)
        })?;

        if output.status.success() {
            let response = String::from_utf8_lossy(&output.stdout).to_string();
            if response.is_empty() {
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
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?;

    result
}

/// Stream a message to Claude CLI and emit chunks via Tauri events
pub async fn stream_message_to_claude(
    window: Window,
    message: String,
    cancel_state: Arc<CancelState>,
) -> Result<String, String> {
    use std::io::Read;
    use std::process::Command as StdCommand;
    #[cfg(windows)]
    use std::os::windows::process::CommandExt;

    let claude_cli = find_claude_cli();

    // Build and spawn the command
    let mut child = {
        let mut cmd;

        match claude_cli {
            Some((node_path, script_path)) => {
                cmd = StdCommand::new(&node_path);
                cmd.arg(&script_path);
            }
            None => {
                return Err("Claude CLI not found. Please install it with: npm install -g @anthropic-ai/claude-code".to_string());
            }
        }

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        cmd.arg("--print");
        cmd.arg(&message);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        cmd.spawn().map_err(|e| {
            format!("Failed to spawn Claude CLI: {}. Make sure node is installed.", e)
        })?
    };

    let mut stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr_handle = child.stderr.take();

    let mut full_response = String::new();
    // Use 8KB buffer for better performance with large responses
    let mut buffer = [0u8; 8192];

    // Use a thread for blocking reads, check cancellation periodically
    let window_clone = window.clone();
    let (tx, mut rx) = tokio::sync::mpsc::channel::<Result<Vec<u8>, String>>(32);

    // Spawn a thread to read stdout
    let reader_handle = std::thread::spawn(move || {
        loop {
            match stdout.read(&mut buffer) {
                Ok(0) => {
                    // EOF
                    let _ = tx.blocking_send(Ok(vec![]));
                    break;
                }
                Ok(n) => {
                    if tx.blocking_send(Ok(buffer[..n].to_vec())).is_err() {
                        break;
                    }
                }
                Err(e) => {
                    let _ = tx.blocking_send(Err(e.to_string()));
                    break;
                }
            }
        }
    });

    // Process chunks
    loop {
        // Check for cancellation atomically (no lock needed)
        if cancel_state.flag.load(Ordering::SeqCst) {
            let _ = child.kill();
            drop(rx);
            let _ = reader_handle.join();
            window
                .emit("claude-stream-cancelled", ())
                .map_err(|e| format!("Failed to emit cancel event: {}", e))?;
            return Err("Generation cancelled by user".to_string());
        }

        // Try to receive with timeout (increased from 100ms to 500ms for efficiency)
        match tokio::time::timeout(std::time::Duration::from_millis(500), rx.recv()).await {
            Ok(Some(Ok(data))) => {
                if data.is_empty() {
                    // EOF
                    break;
                }
                let chunk = String::from_utf8_lossy(&data);
                full_response.push_str(&chunk);
                window_clone
                    .emit("claude-stream-chunk", chunk.as_ref())
                    .map_err(|e| format!("Failed to emit stream chunk: {}", e))?;
            }
            Ok(Some(Err(e))) => {
                window_clone
                    .emit("claude-stream-error", &e)
                    .map_err(|err| format!("Failed to emit error event: {}", err))?;
                return Err(format!("Read error: {}", e));
            }
            Ok(None) => {
                // Channel closed
                break;
            }
            Err(_) => {
                // Timeout, continue to check cancellation
                continue;
            }
        }
    }

    let _ = reader_handle.join();

    // Wait for process to complete
    let status = child.wait().map_err(|e| format!("Failed to wait for Claude process: {}", e))?;

    if status.success() {
        window
            .emit("claude-stream-complete", &full_response)
            .map_err(|e| format!("Failed to emit completion event: {}", e))?;
        Ok(full_response)
    } else {
        let stderr_text = if let Some(mut stderr) = stderr_handle {
            let mut buf = String::new();
            use std::io::Read;
            stderr.read_to_string(&mut buf).unwrap_or_default();
            buf
        } else {
            String::new()
        };

        let error_msg = if stderr_text.is_empty() {
            "Claude CLI failed with no error message".to_string()
        } else {
            stderr_text
        };

        window
            .emit("claude-stream-error", &error_msg)
            .map_err(|e| format!("Failed to emit error event: {}", e))?;

        Err(format!("Claude CLI error: {}", error_msg))
    }
}
