// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::process::{Command, Child};
use std::sync::Mutex;

/// Python Agent 进程管理
struct PythonAgent(Mutex<Option<Child>>);

#[tauri::command]
async fn start_agent(app: tauri::AppHandle) -> Result<String, String> {
    // 获取应用资源路径
    let resource_path = app.path_resolver()
        .resource_dir()
        .expect("无法获取资源目录");

    // Python Agent 可执行文件路径
    let agent_path = resource_path.join("python-dist").join("growplan-agent");

    // 启动 Python Agent
    let child = Command::new(agent_path)
        .arg("--config")
        .arg(resource_path.join("config.json"))
        .spawn()
        .map_err(|e| format!("启动Agent失败: {}", e))?;

    // 保存进程
    let agent_state = app.state::<PythonAgent>();
    *agent_state.0.lock().unwrap() = Some(child);

    Ok("Agent启动成功".to_string())
}

#[tauri::command]
async fn stop_agent(app: tauri::AppHandle) -> Result<String, String> {
    let agent_state = app.state::<PythonAgent>();
    let mut child = agent_state.0.lock().unwrap();

    if let Some(mut process) = child.take() {
        process.kill().map_err(|e| format!("停止Agent失败: {}", e))?;
        Ok("Agent已停止".to_string())
    } else {
        Ok("Agent未运行".to_string())
    }
}

#[tauri::command]
async fn send_message(message: String) -> Result<String, String> {
    // 通过 stdin 发送消息给 Python Agent
    // 实际实现需要使用 IPC 或 HTTP
    Ok(format!("消息已发送: {}", message))
}

fn main() {
    tauri::Builder::default()
        .manage(PythonAgent(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            start_agent,
            stop_agent,
            send_message
        ])
        .run(tauri::generate_context!())
        .expect("启动Tauri应用失败");
}