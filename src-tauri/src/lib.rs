use std::collections::HashMap;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![proxy_request])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
