use std::collections::HashMap;

#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem};
#[cfg(target_os = "windows")]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
#[cfg(desktop)]
use tauri::{App, Manager, PhysicalPosition, WebviewWindow};
use tauri::AppHandle;

const DASHBOARD_LABEL: &str = "dashboard";
const MAIN_LABEL: &str = "main";
const DASHBOARD_WIDTH: f64 = 420.0;
const DASHBOARD_HEIGHT: f64 = 640.0;

// Proxy HTTP request through a configured proxy server
#[tauri::command]
async fn proxy_request(
    url: String,
    method: String,
    body: Option<String>,
    headers: HashMap<String, String>,
    proxy_host: String,
    proxy_port: u16,
) -> Result<String, String> {
    let proxy_url = format!("http://{}:{}", proxy_host, proxy_port);
    let proxy = reqwest::Proxy::all(&proxy_url).map_err(|e| e.to_string())?;

    let client = reqwest::Client::builder()
        .proxy(proxy)
        .build()
        .map_err(|e| e.to_string())?;

    let mut req_builder = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PATCH" => client.patch(&url),
        "DELETE" => client.delete(&url),
        "PUT" => client.put(&url),
        _ => return Err(format!("Unsupported HTTP method: {}", method)),
    };

    for (key, value) in &headers {
        req_builder = req_builder.header(key, value);
    }

    if let Some(body_str) = body {
        req_builder = req_builder.body(body_str);
    }

    let response = req_builder.send().await.map_err(|e| e.to_string())?;
    let status = response.status();
    let response_text = response.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("HTTP {} - {}", status.as_u16(), response_text));
    }

    Ok(response_text)
}

#[cfg(desktop)]
fn dashboard_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(DASHBOARD_LABEL)
        .ok_or_else(|| "dashboard window was not found".to_string())
}

#[cfg(desktop)]
fn position_dashboard(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.current_monitor()?.or(window.primary_monitor()?) else {
        return Ok(());
    };

    let work_area = monitor.work_area();
    let scale_factor = monitor.scale_factor();
    let width = (DASHBOARD_WIDTH * scale_factor).round() as i32;
    let height = (DASHBOARD_HEIGHT * scale_factor).round() as i32;
    let x = work_area.position.x + work_area.size.width as i32 - width;
    let y = work_area.position.y + work_area.size.height as i32 - height;

    window.set_position(PhysicalPosition::new(
        x.max(work_area.position.x),
        y.max(work_area.position.y),
    ))
}

#[cfg(desktop)]
fn show_dashboard(app: &AppHandle) -> Result<(), String> {
    let window = dashboard_window(app)?;
    position_dashboard(&window).map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

#[cfg(desktop)]
fn report_tray_error(action: &str, result: Result<(), String>) {
    if let Err(err) = result {
        eprintln!("failed to {action}: {err}");
    }
}

#[tauri::command]
#[cfg(desktop)]
fn toggle_dashboard(app: AppHandle) -> Result<(), String> {
    let window = dashboard_window(&app)?;

    if window.is_visible().map_err(|e| e.to_string())? {
        window.hide().map_err(|e| e.to_string())
    } else {
        position_dashboard(&window).map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())
    }
}

#[tauri::command]
#[cfg(not(desktop))]
fn toggle_dashboard(_app: AppHandle) -> Result<(), String> {
    Err("toggle_dashboard is only available on desktop".to_string())
}

#[tauri::command]
#[cfg(desktop)]
fn hide_dashboard(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(DASHBOARD_LABEL) {
        window.hide().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
#[cfg(not(desktop))]
fn hide_dashboard(_app: AppHandle) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
#[cfg(desktop)]
fn open_main(app: AppHandle, route: Option<String>) -> Result<(), String> {
    let window = app
        .get_webview_window(MAIN_LABEL)
        .ok_or_else(|| "main window was not found".to_string())?;

    if let Some(route) = route.filter(|route| !route.trim().is_empty()) {
        let route = if route.starts_with('/') {
            route
        } else {
            format!("/{}", route)
        };
        window
            .eval(&format!("window.location.hash = {:?};", route))
            .map_err(|e| e.to_string())?;
    }

    window.show().map_err(|e| e.to_string())?;
    window.unminimize().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
#[cfg(not(desktop))]
fn open_main(_app: AppHandle, _route: Option<String>) -> Result<(), String> {
    Err("open_main is only available on desktop".to_string())
}

#[cfg(target_os = "windows")]
fn setup_tray(app: &App) -> tauri::Result<()> {
    let open_dashboard =
        MenuItem::with_id(app, "open_dashboard", "Open Dashboard", true, None::<&str>)?;
    let open_full_app =
        MenuItem::with_id(app, "open_full_app", "Open Full App", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_dashboard, &open_full_app, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open_dashboard" => {
                report_tray_error("show dashboard from tray menu", show_dashboard(app));
            }
            "open_full_app" => {
                report_tray_error("open full app from tray menu", open_main(app.clone(), None));
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                report_tray_error(
                    "toggle dashboard from tray click",
                    toggle_dashboard(tray.app_handle().clone()),
                );
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn setup_tray(_app: &tauri::App) -> tauri::Result<()> {
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            setup_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(desktop)]
            if window.label() == DASHBOARD_LABEL || window.label() == MAIN_LABEL {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if let Err(err) = window.hide() {
                        eprintln!("failed to hide {} on close: {err}", window.label());
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            proxy_request,
            toggle_dashboard,
            hide_dashboard,
            open_main
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
