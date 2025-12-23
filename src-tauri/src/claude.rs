use std::process::Stdio;
use tokio::process::Command;

/// Send a message to Claude CLI and get the response
pub async fn send_message_to_claude(message: &str) -> Result<String, String> {
    let mut cmd = Command::new("claude");

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
