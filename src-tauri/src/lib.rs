use serde::Serialize;
use std::{
  fs,
  io::Write,
  path::{Path, PathBuf},
};
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, FilePath};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BookifyFile {
  path: String,
  file_name: String,
  contents: String,
}

fn resolve_dialog_path(path: FilePath) -> Result<PathBuf, String> {
  match path {
    FilePath::Path(path) => Ok(path),
    FilePath::Url(url) => url
      .to_file_path()
      .map_err(|_| "Percorso file non valido".to_string()),
  }
}

fn file_name_of(path: &Path, fallback: &str) -> String {
  path
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or(fallback)
    .to_string()
}

/// Writes the file atomically: data goes to a sibling temp file which is
/// flushed to disk and then renamed over the target, so a crash or power
/// loss mid-save can never leave a half-written manuscript behind.
fn write_atomic(target: &Path, contents: &str) -> Result<(), String> {
  let parent = target
    .parent()
    .filter(|p| !p.as_os_str().is_empty())
    .unwrap_or_else(|| Path::new("."));
  let tmp_name = format!(".{}.tmp", file_name_of(target, "bookify"));
  let tmp_path = parent.join(tmp_name);

  let write_result = (|| -> std::io::Result<()> {
    let mut file = fs::File::create(&tmp_path)?;
    file.write_all(contents.as_bytes())?;
    file.sync_all()?;
    Ok(())
  })();

  if let Err(error) = write_result {
    let _ = fs::remove_file(&tmp_path);
    return Err(format!("Scrittura non riuscita: {error}"));
  }

  fs::rename(&tmp_path, target).map_err(|error| {
    let _ = fs::remove_file(&tmp_path);
    format!("Impossibile sostituire il file: {error}")
  })
}

#[tauri::command]
async fn save_bookify_file(
  app: tauri::AppHandle,
  contents: String,
  default_name: String,
  path: Option<String>,
) -> Result<Option<BookifyFile>, String> {
  let selected_path = match path.filter(|p| !p.trim().is_empty()) {
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
      resolve_dialog_path(path)?
    }
  };

  write_atomic(&selected_path, &contents)?;

  Ok(Some(BookifyFile {
    file_name: file_name_of(&selected_path, &default_name),
    path: selected_path.to_string_lossy().into_owned(),
    contents: String::new(),
  }))
}

#[tauri::command]
async fn open_bookify_file(app: tauri::AppHandle) -> Result<Option<BookifyFile>, String> {
  let Some(path) = app
    .dialog()
    .file()
    .add_filter("Bookify", &["bookify", "json"])
    .blocking_pick_file()
  else {
    return Ok(None);
  };

  read_file(&resolve_dialog_path(path)?).map(Some)
}

/// Exports text (chapter, full manuscript, library backup) through a native
/// "Save as" dialog. Returns the chosen file name, or None when cancelled.
#[tauri::command]
async fn export_text_file(
  app: tauri::AppHandle,
  contents: String,
  default_name: String,
  filter_name: String,
  extensions: Vec<String>,
) -> Result<Option<String>, String> {
  let ext_refs: Vec<&str> = extensions.iter().map(String::as_str).collect();
  let Some(path) = app
    .dialog()
    .file()
    .add_filter(&filter_name, &ext_refs)
    .set_file_name(&default_name)
    .blocking_save_file()
  else {
    return Ok(None);
  };
  let path = resolve_dialog_path(path)?;
  write_atomic(&path, &contents)?;
  Ok(Some(file_name_of(&path, &default_name)))
}

fn read_file(path: &Path) -> Result<BookifyFile, String> {
  let contents = fs::read_to_string(path).map_err(|error| format!("Lettura non riuscita: {error}"))?;
  Ok(BookifyFile {
    path: path.to_string_lossy().into_owned(),
    file_name: file_name_of(path, "progetto.bookify"),
    contents,
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      save_bookify_file,
      open_bookify_file,
      export_text_file
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Safety net: the window starts hidden so the splash screen is the
      // first thing painted. The frontend shows it as soon as the splash is
      // on screen; if that never happens, show it anyway after a few seconds.
      if let Some(window) = app.get_webview_window("main") {
        std::thread::spawn(move || {
          std::thread::sleep(std::time::Duration::from_secs(4));
          if !window.is_visible().unwrap_or(true) {
            let _ = window.show();
            let _ = window.set_focus();
          }
        });
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
