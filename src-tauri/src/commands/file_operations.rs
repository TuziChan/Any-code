use std::process::Command as StdCommand;

/// Open a directory in the system file explorer (cross-platform)
#[tauri::command]
pub async fn open_directory_in_explorer(directory_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = StdCommand::new("explorer");
        cmd.arg(&directory_path);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        StdCommand::new("open")
            .arg(&directory_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        StdCommand::new("xdg-open")
            .arg(&directory_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    Ok(())
}

/// Open a directory in the system terminal (cross-platform)
#[tauri::command]
pub async fn open_directory_in_terminal(directory_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        // Try Windows Terminal (wt.exe) first — available on Windows 11 and Win10 with manual install
        let wt_result = {
            let mut cmd = StdCommand::new("wt");
            cmd.args(&["-d", &directory_path]);
            cmd.creation_flags(CREATE_NO_WINDOW);
            cmd.spawn()
        };

        if wt_result.is_err() {
            // Fallback to PowerShell for Windows 10
            let mut cmd = StdCommand::new("powershell");
            cmd.args(&["-NoExit", "-Command", &format!("Set-Location '{}'", &directory_path)]);
            cmd.creation_flags(CREATE_NO_WINDOW);
            cmd.spawn()
                .map_err(|e| format!("Failed to open terminal: {}", e))?;
        }
    }

    #[cfg(target_os = "macos")]
    {
        StdCommand::new("open")
            .args(&["-a", "Terminal", &directory_path])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Try common terminal emulators
        let terminals = ["x-terminal-emulator", "gnome-terminal", "konsole", "xterm"];
        let mut opened = false;
        for term in &terminals {
            if StdCommand::new(term)
                .arg("--working-directory")
                .arg(&directory_path)
                .spawn()
                .is_ok()
            {
                opened = true;
                break;
            }
        }
        if !opened {
            return Err("No terminal emulator found".to_string());
        }
    }

    Ok(())
}

/// Open a file with the system's default application (cross-platform)
#[tauri::command]
pub async fn open_file_with_default_app(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // Use 'start' command through cmd to open file with default app
        let mut cmd = StdCommand::new("cmd");
        cmd.args(&["/C", "start", "", &file_path]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        StdCommand::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        StdCommand::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}
