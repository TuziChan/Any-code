/// Engine Manager - Install/Update/Uninstall CLI engines
///
/// Manages Claude Code, Codex CLI, and Gemini CLI lifecycle.
/// All operations run npm commands and return streaming-friendly results.
/// Also includes ToolSearch domain restriction patch detection and fix.
use regex::bytes::Regex;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
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

// ─── ToolSearch Patch ───

#[derive(Debug, Serialize, Clone)]
pub struct ToolSearchPatchStatus {
    /// "unpatched" | "patched" | "not_found" | "unknown"
    pub status: String,
    /// Human-readable message
    pub message: String,
    /// Path to the detected installation file (if found)
    pub target_path: Option<String>,
    /// Installation kind (bun, npm, pnpm, etc.)
    pub install_kind: Option<String>,
}

/// Find the JS file containing the domain check inside an npm package directory
fn find_patch_target_in_pkg(pkg_dir: &Path) -> Option<PathBuf> {
    let cli_js = pkg_dir.join("cli.js");
    if cli_js.is_file() {
        if let Ok(data) = fs::read(&cli_js) {
            if data.windows(18).any(|w| w == b"api.anthropic.com") {
                return Some(cli_js);
            }
        }
    }
    // Search all .js files in the package
    if let Ok(entries) = walkdir_js_files(pkg_dir) {
        for js_file in entries {
            if let Ok(meta) = fs::metadata(&js_file) {
                if meta.len() < 1000 {
                    continue;
                }
            }
            if let Ok(data) = fs::read(&js_file) {
                if data.windows(18).any(|w| w == b"api.anthropic.com") {
                    return Some(js_file);
                }
            }
        }
    }
    None
}

/// Recursively find .js files in a directory
fn walkdir_js_files(dir: &Path) -> Result<Vec<PathBuf>, std::io::Error> {
    let mut results = Vec::new();
    fn walk(dir: &Path, results: &mut Vec<PathBuf>) -> Result<(), std::io::Error> {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                let _ = walk(&path, results);
            } else if path.extension().map_or(false, |ext| ext == "js") {
                results.push(path);
            }
        }
        Ok(())
    }
    walk(dir, &mut results)?;
    Ok(results)
}

/// Find all Claude Code installations and return the first viable one
fn find_claude_installation() -> Option<(String, PathBuf)> {
    let home = dirs::home_dir()?;
    let is_windows = cfg!(target_os = "windows");

    // 1. bun installation - 与 Python 脚本保持一致，不检查文件大小
    let bun_candidates: Vec<PathBuf> = if is_windows {
        vec![home.join(".local").join("bin").join("claude.exe")]
    } else {
        vec![
            home.join(".claude").join("local").join("claude"),
            home.join(".local").join("bin").join("claude"),
        ]
    };
    for p in &bun_candidates {
        if p.is_file() {
            // Python 脚本不检查文件大小，直接返回
            return Some(("bun".to_string(), p.clone()));
        }
    }

    // 2. npm global
    if let Some(npm_root) = run_shell_cmd(&["npm", "root", "-g"]) {
        let pkg_dir = PathBuf::from(&npm_root)
            .join("@anthropic-ai")
            .join("claude-code");
        if pkg_dir.is_dir() {
            if let Some(target) = find_patch_target_in_pkg(&pkg_dir) {
                return Some(("npm".to_string(), target));
            }
        }
    } else {
        // npm fallback: scan common node_modules locations
        if let Some(result) = find_npm_fallback(&home, is_windows) {
            return Some(result);
        }
    }

    // 3. pnpm global
    if let Some(pnpm_root) = run_shell_cmd(&["pnpm", "root", "-g"]) {
        let pkg_dir = PathBuf::from(&pnpm_root)
            .join("@anthropic-ai")
            .join("claude-code");
        if pkg_dir.is_dir() {
            if let Some(target) = find_patch_target_in_pkg(&pkg_dir) {
                return Some(("pnpm".to_string(), target));
            }
        }

        // Fallback: search in .pnpm directory (Python 脚本的逻辑)
        if let Some(parent) = PathBuf::from(&pnpm_root).parent() {
            let pnpm_dir = parent.join(".pnpm");
            if pnpm_dir.is_dir() {
                if let Ok(entries) = fs::read_dir(&pnpm_dir) {
                    for entry in entries.filter_map(|e| e.ok()) {
                        let path = entry.path();
                        if path.is_dir() {
                            let pkg = path.join("@anthropic-ai").join("claude-code");
                            if pkg.is_dir() {
                                if let Some(target) = find_patch_target_in_pkg(&pkg) {
                                    return Some(("pnpm".to_string(), target));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. VS Code / Cursor extensions
    let ext_bases = vec![
        ("vscode", home.join(".vscode").join("extensions")),
        ("vscode-insiders", home.join(".vscode-insiders").join("extensions")),
        ("cursor", home.join(".cursor").join("extensions")),
    ];
    for (kind, base) in &ext_bases {
        if !base.is_dir() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(base) {
            let mut ext_dirs: Vec<PathBuf> = entries
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| {
                    p.file_name()
                        .map_or(false, |n| n.to_string_lossy().starts_with("anthropic.claude-code-"))
                })
                .collect();
            ext_dirs.sort();
            ext_dirs.reverse();
            if let Some(ext_dir) = ext_dirs.first() {
                let names = if is_windows {
                    vec!["claude.exe", "claude"]
                } else {
                    vec!["claude"]
                };
                for name in names {
                    if let Some(target) = find_binary_recursive(ext_dir, name) {
                        return Some((kind.to_string(), target));
                    }
                }
            }
        }
    }

    // 5. WSL installations (Windows only)
    #[cfg(target_os = "windows")]
    {
        if let Some(result) = find_wsl_installations(&home) {
            return Some(result);
        }
    }

    None
}

/// Run a shell command and return trimmed stdout, or None on failure
fn run_shell_cmd(args: &[&str]) -> Option<String> {
    let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
    let flag = if cfg!(target_os = "windows") { "/C" } else { "-c" };
    let cmd_str = args.join(" ");
    let output = Command::new(shell).arg(flag).arg(&cmd_str).output().ok()?;
    if output.status.success() {
        let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if s.is_empty() { None } else { Some(s) }
    } else {
        None
    }
}

/// Scan common node version manager directories for npm-installed claude-code
fn find_npm_fallback(home: &Path, is_windows: bool) -> Option<(String, PathBuf)> {
    let mut search_dirs: Vec<PathBuf> = Vec::new();

    if is_windows {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let appdata = PathBuf::from(&appdata);
            search_dirs.push(appdata.join("npm").join("node_modules"));
            // nvm-windows
            let nvm_home = std::env::var("NVM_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|_| appdata.join("nvm"));
            if nvm_home.is_dir() {
                if let Ok(entries) = fs::read_dir(&nvm_home) {
                    for e in entries.filter_map(|e| e.ok()) {
                        let nm = e.path().join("node_modules");
                        if nm.is_dir() {
                            search_dirs.push(nm);
                        }
                    }
                }
            }
        }
        // fnm
        let fnm_dir = std::env::var("FNM_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home.join(".fnm"));
        let nv = fnm_dir.join("node-versions");
        if nv.is_dir() {
            if let Ok(entries) = fs::read_dir(&nv) {
                for e in entries.filter_map(|e| e.ok()) {
                    let nm = e.path().join("installation").join("node_modules");
                    if nm.is_dir() {
                        search_dirs.push(nm);
                    }
                }
            }
        }
    } else {
        // nvm
        let nvm_dir = std::env::var("NVM_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home.join(".nvm"));
        let versions = nvm_dir.join("versions").join("node");
        if versions.is_dir() {
            if let Ok(entries) = fs::read_dir(&versions) {
                for e in entries.filter_map(|e| e.ok()) {
                    let nm = e.path().join("lib").join("node_modules");
                    if nm.is_dir() {
                        search_dirs.push(nm);
                    }
                }
            }
        }
        // fnm
        let fnm_dir = std::env::var("FNM_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home.join(".fnm"));
        let nv = fnm_dir.join("node-versions");
        if nv.is_dir() {
            if let Ok(entries) = fs::read_dir(&nv) {
                for e in entries.filter_map(|e| e.ok()) {
                    let nm = e.path().join("installation").join("lib").join("node_modules");
                    if nm.is_dir() {
                        search_dirs.push(nm);
                    }
                }
            }
        }
        // system-level
        for p in &["/usr/local/lib/node_modules", "/usr/lib/node_modules"] {
            let pp = PathBuf::from(p);
            if pp.is_dir() {
                search_dirs.push(pp);
            }
        }
    }

    // volta (cross-platform)
    let volta_home = std::env::var("VOLTA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| home.join(".volta"));
    let volta_node = volta_home.join("tools").join("image").join("node");
    if volta_node.is_dir() {
        if let Ok(entries) = fs::read_dir(&volta_node) {
            for e in entries.filter_map(|e| e.ok()) {
                let nm = if is_windows {
                    e.path().join("node_modules")
                } else {
                    e.path().join("lib").join("node_modules")
                };
                if nm.is_dir() {
                    search_dirs.push(nm);
                }
            }
        }
    }

    for nm_dir in search_dirs {
        let pkg_dir = nm_dir.join("@anthropic-ai").join("claude-code");
        if pkg_dir.is_dir() {
            if let Some(target) = find_patch_target_in_pkg(&pkg_dir) {
                return Some(("npm".to_string(), target));
            }
        }
    }
    None
}

/// Get list of installed WSL distributions
fn get_wsl_distros() -> Vec<String> {
    let output = match Command::new("wsl.exe")
        .arg("--list")
        .arg("--quiet")
        .output()
    {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };

    if !output.status.success() {
        return Vec::new();
    }

    let text = String::from_utf8_lossy(&output.stdout);
    text.lines()
        .filter_map(|l| {
            let trimmed = l.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
        .collect()
}

/// Check if a path is safely accessible (handle WSL UNC path permission issues)
fn safe_is_dir(path: &Path) -> bool {
    path.is_dir()
}

/// Find Claude Code installation in WSL distributions (only on Windows)
#[cfg(target_os = "windows")]
fn find_wsl_installations(home: &Path) -> Option<(String, PathBuf)> {
    let distros = get_wsl_distros();
    if distros.is_empty() {
        return None;
    }

    for dname in &distros {
        let distro = PathBuf::from(format!("//wsl.localhost/{}", dname));
        if !safe_is_dir(&distro) {
            continue;
        }

        // Collect user home directories
        let mut user_dirs: Vec<PathBuf> = Vec::new();
        let home_base = distro.join("home");
        if safe_is_dir(&home_base) {
            if let Ok(entries) = fs::read_dir(&home_base) {
                for e in entries.filter_map(|e| e.ok()) {
                    if e.path().is_dir() {
                        user_dirs.push(e.path());
                    }
                }
            }
        }
        let root_home = distro.join("root");
        if safe_is_dir(&root_home) {
            user_dirs.push(root_home);
        }

        for udir in &user_dirs {
            // 1. bun: ~/.local/share/claude/versions/<ver>
            let versions_dir = udir.join(".local").join("share").join("claude").join("versions");
            if safe_is_dir(&versions_dir) {
                if let Ok(entries) = fs::read_dir(&versions_dir) {
                    let mut vers: Vec<_> = entries.filter_map(|e| e.ok()).collect();
                    vers.sort_by(|a, b| b.file_name().cmp(&a.file_name()));
                    for v in vers {
                        let path = v.path();
                        // Skip backup files
                        if path.file_name()
                            .map_or(false, |n| n.to_string_lossy().ends_with(".toolsearch-bak"))
                        {
                            continue;
                        }
                        if path.is_file() {
                            if let Ok(meta) = fs::metadata(&path) {
                                if meta.len() > 10 * 1024 * 1024 {
                                    return Some(("wsl".to_string(), path));
                                }
                            }
                        }
                    }
                }
            }

            // 2. npm: scan nvm, fnm, volta
            let npm_search: Vec<(PathBuf, &str)> = Vec::new();

            // nvm: ~/.nvm/versions/node/<ver>/lib/node_modules
            let nvm_node = udir.join(".nvm").join("versions").join("node");
            if safe_is_dir(&nvm_node) {
                if let Ok(entries) = fs::read_dir(&nvm_node) {
                    for v in entries.filter_map(|e| e.ok()) {
                        let nm = v.path().join("lib").join("node_modules");
                        if v.path().is_dir() && nm.is_dir() {
                            // Can't easily pass label here, use a workaround
                        }
                    }
                }
            }

            // fnm: ~/.fnm/node-versions/<ver>/installation/lib/node_modules
            let fnm_nv = udir.join(".fnm").join("node-versions");
            if safe_is_dir(&fnm_nv) {
                if let Ok(entries) = fs::read_dir(&fnm_nv) {
                    for v in entries.filter_map(|e| e.ok()) {
                        let nm = v.path().join("installation").join("lib").join("node_modules");
                        if v.path().is_dir() && nm.is_dir() {
                            let pkg = nm.join("@anthropic-ai").join("claude-code");
                            if let Some(target) = find_patch_target_in_pkg(&pkg) {
                                return Some(("wsl".to_string(), target));
                            }
                        }
                    }
                }
            }

            // volta: ~/.volta/tools/image/node/<ver>/lib/node_modules
            let volta_node = udir.join(".volta").join("tools").join("image").join("node");
            if safe_is_dir(&volta_node) {
                if let Ok(entries) = fs::read_dir(&volta_node) {
                    for v in entries.filter_map(|e| e.ok()) {
                        let nm = v.path().join("lib").join("node_modules");
                        if v.path().is_dir() && nm.is_dir() {
                            let pkg = nm.join("@anthropic-ai").join("claude-code");
                            if let Some(target) = find_patch_target_in_pkg(&pkg) {
                                return Some(("wsl".to_string(), target));
                            }
                        }
                    }
                }
            }
        }

        // 3. System-level npm: /usr/local/lib/node_modules, /usr/lib/node_modules
        for sys_nm in &[
            distro.join("usr").join("local").join("lib").join("node_modules"),
            distro.join("usr").join("lib").join("node_modules"),
        ] {
            let pkg = sys_nm.join("@anthropic-ai").join("claude-code");
            if safe_is_dir(&pkg) {
                if let Some(target) = find_patch_target_in_pkg(&pkg) {
                    return Some(("wsl".to_string(), target));
                }
            }
        }
    }

    None
}

/// Recursively find a binary file by name (for VS Code extensions)
fn find_binary_recursive(dir: &Path, name: &str) -> Option<PathBuf> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            // Skip .bak backup files (Python 脚本的逻辑)
            if path.file_name()
                .map_or(false, |n| n.to_string_lossy().ends_with(".bak"))
            {
                continue;
            }
            if path.is_file() && path.file_name().map_or(false, |n| n == name) {
                if let Ok(meta) = fs::metadata(&path) {
                    if meta.len() > 10 * 1024 * 1024 {
                        return Some(path);
                    }
                }
            } else if path.is_dir() {
                if let Some(found) = find_binary_recursive(&path, name) {
                    return Some(found);
                }
            }
        }
    }
    None
}

/// Check ToolSearch patch status for the detected Claude Code installation
fn check_toolsearch_patch_status_sync() -> ToolSearchPatchStatus {
    let installation = find_claude_installation();
    let (kind, target) = match installation {
        Some((k, t)) => (k, t),
        None => {
            return ToolSearchPatchStatus {
                status: "not_found".to_string(),
                message: "未检测到 Claude Code 安装".to_string(),
                target_path: None,
                install_kind: None,
            };
        }
    };

    let data = match fs::read(&target) {
        Ok(d) => d,
        Err(e) => {
            return ToolSearchPatchStatus {
                status: "unknown".to_string(),
                message: format!("无法读取文件: {}", e),
                target_path: Some(target.to_string_lossy().to_string()),
                install_kind: Some(kind),
            };
        }
    };

    let unpatched_re = Regex::new(
        r#"return\["api\.anthropic\.com"\]\.includes\([A-Za-z_$][A-Za-z0-9_$]*\)\}catch\{return!1\}"#,
    ).unwrap();
    let patched_re = Regex::new(r#"return!0/\* *\*/\}catch\{return!0\}"#).unwrap();

    let status = if unpatched_re.is_match(&data) {
        "unpatched"
    } else if patched_re.is_match(&data) {
        "patched"
    } else {
        "unknown"
    };

    let message = match status {
        "unpatched" => "ToolSearch 域名限制未解除，使用第三方代理时 ToolSearch 不可用".to_string(),
        "patched" => "ToolSearch 域名限制已解除".to_string(),
        _ => "无法识别当前版本的 ToolSearch 状态，可能版本不兼容".to_string(),
    };

    ToolSearchPatchStatus {
        status: status.to_string(),
        message,
        target_path: Some(target.to_string_lossy().to_string()),
        install_kind: Some(kind),
    }
}

/// Apply the ToolSearch patch to remove domain restriction
fn apply_toolsearch_patch_sync() -> EngineActionResult {
    let installation = find_claude_installation();
    let (_kind, target) = match installation {
        Some((k, t)) => (k, t),
        None => {
            return EngineActionResult {
                success: false,
                message: "未检测到 Claude Code 安装".to_string(),
                output: String::new(),
            };
        }
    };

    let data = match fs::read(&target) {
        Ok(d) => d,
        Err(e) => {
            return EngineActionResult {
                success: false,
                message: format!("无法读取文件: {}", e),
                output: String::new(),
            };
        }
    };

    let unpatched_re = Regex::new(
        r#"return\["api\.anthropic\.com"\]\.includes\([A-Za-z_$][A-Za-z0-9_$]*\)\}catch\{return!1\}"#,
    ).unwrap();
    let patched_re = Regex::new(r#"return!0/\* *\*/\}catch\{return!0\}"#).unwrap();

    // Already patched?
    if patched_re.is_match(&data) {
        return EngineActionResult {
            success: true,
            message: "ToolSearch 已经修复过了，无需重复操作".to_string(),
            output: String::new(),
        };
    }

    if !unpatched_re.is_match(&data) {
        return EngineActionResult {
            success: false,
            message: "未找到目标代码，可能版本不兼容".to_string(),
            output: String::new(),
        };
    }

    // Create backup
    let backup_path = target.with_extension("js.toolsearch-bak");
    if let Err(e) = fs::copy(&target, &backup_path) {
        // Non-fatal for bun binaries that don't have .js extension
        log::warn!("备份创建失败: {}", e);
    }

    // Apply patch: replace the domain check with return!0
    let patched_data = unpatched_re.replace_all(&data, |caps: &regex::bytes::Captures| {
        let original_len = caps[0].len();
        let prefix = b"return!0/*";
        let suffix = b"*/}catch{return!0}";
        let padding = original_len.saturating_sub(prefix.len() + suffix.len());
        let mut result = Vec::with_capacity(original_len);
        result.extend_from_slice(prefix);
        result.extend(std::iter::repeat(b' ').take(padding));
        result.extend_from_slice(suffix);
        result
    });

    // Write patched file
    match fs::write(&target, patched_data.as_ref()) {
        Ok(_) => EngineActionResult {
            success: true,
            message: "ToolSearch 域名限制已成功解除，重启 Claude Code 生效".to_string(),
            output: format!("已修补: {}", target.to_string_lossy()),
        },
        Err(e) => {
            // Try rename-based write for locked files
            match write_via_rename(&target, patched_data.as_ref()) {
                Ok(_) => EngineActionResult {
                    success: true,
                    message: "ToolSearch 域名限制已成功解除（通过重命名方式），重启 Claude Code 生效".to_string(),
                    output: format!("已修补: {}", target.to_string_lossy()),
                },
                Err(e2) => EngineActionResult {
                    success: false,
                    message: format!("写入失败: {}，重命名也失败: {}。请关闭 Claude Code 后重试", e, e2),
                    output: String::new(),
                },
            }
        }
    }
}

/// Write file via rename strategy (for locked files)
fn write_via_rename(target: &Path, data: &[u8]) -> Result<(), String> {
    let tmp_path = target.with_extension("js.tmp");
    let old_path = target.with_extension("js.old");
    let _ = fs::remove_file(&tmp_path);
    let _ = fs::remove_file(&old_path);
    fs::write(&tmp_path, data).map_err(|e| e.to_string())?;
    fs::rename(target, &old_path).map_err(|e| format!("重命名原文件失败: {}", e))?;
    fs::rename(&tmp_path, target).map_err(|e| format!("重命名临时文件失败: {}", e))?;
    let _ = fs::remove_file(&old_path);
    Ok(())
}

#[tauri::command]
pub async fn check_toolsearch_patch() -> Result<ToolSearchPatchStatus, String> {
    Ok(tokio::task::spawn_blocking(check_toolsearch_patch_status_sync)
        .await
        .map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn apply_toolsearch_fix() -> Result<EngineActionResult, String> {
    Ok(tokio::task::spawn_blocking(apply_toolsearch_patch_sync)
        .await
        .map_err(|e| e.to_string())?)
}
