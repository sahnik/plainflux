use crate::error::{AppError, Result};
use std::path::{Path, PathBuf};

/// Ensures a directory exists, creating it if necessary with all parent directories
pub fn ensure_dir_exists<P: AsRef<Path>>(path: P) -> Result<()> {
    let path = path.as_ref();

    if !path.exists() {
        std::fs::create_dir_all(path).map_err(|e| {
            AppError::Io(std::io::Error::new(
                e.kind(),
                format!("Failed to create directory '{}': {e}", path.display()),
            ))
        })?;
    } else if !path.is_dir() {
        return Err(AppError::InvalidInput(format!(
            "Path '{}' exists but is not a directory",
            path.display()
        )));
    }

    Ok(())
}

/// Ensures the parent directory of a file path exists
pub fn ensure_parent_dir_exists<P: AsRef<Path>>(file_path: P) -> Result<()> {
    let path = file_path.as_ref();

    if let Some(parent) = path.parent() {
        ensure_dir_exists(parent)?;
    }

    Ok(())
}

/// Validates that a path is within the allowed notes directory
pub fn validate_path_security<P: AsRef<Path>>(path: P, base_dir: &str) -> Result<()> {
    let path = path.as_ref();
    let base = Path::new(base_dir);

    // Canonicalize paths for comparison (resolves .. and symlinks)
    let canonical_base = base.canonicalize().map_err(|e| {
        AppError::Io(std::io::Error::new(
            e.kind(),
            format!("Failed to canonicalize base directory '{base_dir}': {e}"),
        ))
    })?;

    // If the path doesn't exist yet, check its parent
    let canonical_path = if path.exists() {
        path.canonicalize().map_err(|e| {
            AppError::Io(std::io::Error::new(
                e.kind(),
                format!("Failed to canonicalize path '{}': {e}", path.display()),
            ))
        })?
    } else {
        // For non-existent paths, validate the parent directory
        if let Some(parent) = path.parent() {
            if parent.exists() {
                let canonical_parent = parent.canonicalize().map_err(|e| {
                    AppError::Io(std::io::Error::new(
                        e.kind(),
                        format!("Failed to canonicalize parent directory: {e}"),
                    ))
                })?;

                // Reconstruct the full path
                canonical_parent.join(path.file_name().unwrap_or_default())
            } else {
                // If parent doesn't exist, just ensure the path would be within bounds
                PathBuf::from(base_dir).join(path)
            }
        } else {
            return Err(AppError::InvalidInput(
                "Invalid path: no parent directory".to_string(),
            ));
        }
    };

    // Check if the path is within the base directory
    if !canonical_path.starts_with(&canonical_base) {
        return Err(AppError::InvalidInput(format!(
            "Path '{}' is outside the notes directory",
            path.display()
        )));
    }

    Ok(())
}

/// Safely writes content to a file, ensuring the parent directory exists
pub fn safe_write_file<P: AsRef<Path>>(path: P, content: &str) -> Result<()> {
    let path = path.as_ref();

    // Ensure parent directory exists
    ensure_parent_dir_exists(path)?;

    // Write file atomically (write to temp file then rename)
    let temp_path = path.with_extension("tmp");

    std::fs::write(&temp_path, content).map_err(|e| {
        AppError::Io(std::io::Error::new(
            e.kind(),
            format!(
                "Failed to write temporary file '{}': {e}",
                temp_path.display()
            ),
        ))
    })?;

    std::fs::rename(&temp_path, path).map_err(|e| {
        // Clean up temp file if rename fails
        let _ = std::fs::remove_file(&temp_path);
        AppError::Io(std::io::Error::new(
            e.kind(),
            format!("Failed to rename file to '{}': {e}", path.display()),
        ))
    })?;

    Ok(())
}

/// Safely reads a file with proper error context
pub fn safe_read_file<P: AsRef<Path>>(path: P) -> Result<String> {
    let path = path.as_ref();

    if !path.exists() {
        return Err(AppError::NotFound(format!(
            "File '{}' does not exist",
            path.display()
        )));
    }

    if !path.is_file() {
        return Err(AppError::InvalidInput(format!(
            "Path '{}' is not a file",
            path.display()
        )));
    }

    std::fs::read_to_string(path).map_err(|e| {
        AppError::Io(std::io::Error::new(
            e.kind(),
            format!("Failed to read file '{}': {e}", path.display()),
        ))
    })
}
