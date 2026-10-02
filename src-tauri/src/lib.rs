use serde::Serialize;
use std::{fs, path::PathBuf};
use tauri_plugin_dialog::{DialogExt, FilePath};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BookifyFile {
  path: String,
  file_name: String,
  contents: String,
}

#[tauri::command]
fn save_bookify_file(
  app: tauri::AppHandle,
  contents: String,
  default_name: String,
  path: Option<String>,
) -> Result<Option<BookifyFile>, String> {
  let selected_path = match path {
    Some(path) => PathBuf::from(path),
    None => {
      let Some(path) = app
        .dialog()
        .file()
        .add_filter("Bookify", &["bookify", "json"])
        .set_file_name(&default_name)
        .blocking_save_file()
      else {
        return Ok(None);
      };

      match path {
        FilePath::Path(path) => path,
        FilePath::Url(url) => url
          .to_file_path()
          .map_err(|_| "Percorso file non valido".to_string())?,
      }
    }
  };

  fs::write(&selected_path, contents).map_err(|error| error.to_string())?;
  let file_name = selected_path
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or(&default_name)
    .to_string();

  Ok(Some(BookifyFile {
    path: selected_path.to_string_lossy().into_owned(),
    file_name,
    contents: String::new(),
  }))
}

#[tauri::command]
fn open_bookify_file(app: tauri::AppHandle) -> Result<Option<BookifyFile>, String> {
  let Some(path) = app
    .dialog()
    .file()
    .add_filter("Bookify", &["bookify", "json"])
    .blocking_pick_file()
  else {
    return Ok(None);
  };

  let selected_path = match path {
    FilePath::Path(path) => path,
    FilePath::Url(url) => url
      .to_file_path()
      .map_err(|_| "Percorso file non valido".to_string())?,
  };
  let contents = fs::read_to_string(&selected_path).map_err(|error| error.to_string())?;
  let file_name = selected_path
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or("progetto.bookify")
    .to_string();

  Ok(Some(BookifyFile {
    path: selected_path.to_string_lossy().into_owned(),
    file_name,
    contents,
  }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![save_bookify_file, open_bookify_file])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
