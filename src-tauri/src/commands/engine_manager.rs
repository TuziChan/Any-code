/// Engine Manager - Install/Update/Uninstall CLI engines
///
/// Manages Claude Code, Codex CLI, and Gemini CLI lifecycle.
/// All operations run npm commands and return streaming-friendly results.
use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize, Clone)]
pub struct EngineActionResult {
    pub success: bool,
    pub message: String,
    pub output: String,
}

/// Run an npm global command and capture output
fn run_npm_command(args: &[&str]) -> EngineActionResult {
    let shell = if cfg!(target_os = "windows") {
        "cmd"
    } else {
        "sh"
    };
    let shell_flag = if cfg!(target_os = "windows") {
        "/C"
    } else {
        "-c"
    };
    let npm_cmd = args.join(" ");

    match Command::new(shell)
        .arg(shell_flag)
        .arg(&npm_cmd)
        .output()
    {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let combined = if stderr.is_empty() {
                stdout.clone()
            } else {
                format!("{}\n{}", stdout, stderr)
            };

            EngineActionResult {
                success: output.status.success(),
                message: if output.status.success() {
                    "操作成功".to_string()
                } else {
                    format!("操作失败 (exit code: {})", output.status.code().unwrap_or(-1))
                },
                output: combined.trim().to_string(),
            }
        }
        Err(e) => EngineActionResult {
            success: false,
            message: format!("无法执行命令: {}", e),
            output: String::new(),
        },
    }
}
// ─── Claude Code ───

#[tauri::command]
pub async fn install_claude_cli() -> Result<EngineActionResult, String> {
    Ok(tokio::task::spawn_blocking(|| {
        run_npm_command(&["npm", "install", "-g", "@anthropic-ai/claude-code"])
    })
    .await
    .map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn update_claude_cli() -> Result<EngineActionResult, String> {
    Ok(tokio::task::spawn_blocking(|| {
        run_npm_command(&["npm", "update", "-g", "@anthropic-ai/claude-code"])
    })
    .await
    .map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn uninstall_claude_cli() -> Result<EngineActionResult, String> {
    Ok(tokio::task::spawn_blocking(|| {
        run_npm_command(&["npm", "uninstall", "-g", "@anthropic-ai/claude-code"])
    })
    .await
    .map_err(|e| e.to_string())?)
}

// ─── Codex CLI ───

#[tauri::command]
pub async fn install_codex_cli() -> Result<EngineActionResult, String> {
    Ok(tokio::task::spawn_blocking(|| {
        run_npm_command(&["npm", "install", "-g", "@openai/codex"])
    })
    .await
    .map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn update_codex_cli() -> Result<EngineActionResult, String> {
    Ok(tokio::task::spawn_blocking(|| {
        run_npm_command(&["npm", "update", "-g", "@openai/codex"])
    })
    .await
    .map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn uninstall_codex_cli() -> Result<EngineActionResult, String> {
    Ok(tokio::task::spawn_blocking(|| {
        run_npm_command(&["npm", "uninstall", "-g", "@openai/codex"])
    })
    .await
    .map_err(|e| e.to_string())?)
}

// ─── Gemini CLI ───

#[tauri::command]
pub async fn install_gemini_cli() -> Result<EngineActionResult, String> {
    Ok(tokio::task::spawn_blocking(|| {
        run_npm_command(&["npm", "install", "-g", "@google/gemini-cli"])
    })
    .await
    .map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn update_gemini_cli() -> Result<EngineActionResult, String> {
    Ok(tokio::task::spawn_blocking(|| {
        run_npm_command(&["npm", "update", "-g", "@google/gemini-cli"])
    })
    .await
    .map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn uninstall_gemini_cli() -> Result<EngineActionResult, String> {
    Ok(tokio::task::spawn_blocking(|| {
        run_npm_command(&["npm", "uninstall", "-g", "@google/gemini-cli"])
    })
    .await
    .map_err(|e| e.to_string())?)
}
