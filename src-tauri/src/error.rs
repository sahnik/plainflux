use std::fmt;

#[derive(Debug)]
pub enum AppError {
    Io(std::io::Error),
    Database(String),
    NotFound(String),
    InvalidInput(String),
    LockPoisoned(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Io(e) => write!(f, "IO error: {}", e),
            AppError::Database(e) => write!(f, "Database error: {}", e),
            AppError::NotFound(e) => write!(f, "Not found: {}", e),
            AppError::InvalidInput(e) => write!(f, "Invalid input: {}", e),
            AppError::LockPoisoned(e) => write!(f, "Lock poisoned: {}", e),
        }
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        AppError::Io(error)
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        AppError::Database(error.to_string())
    }
}

impl From<String> for AppError {
    fn from(error: String) -> Self {
        AppError::InvalidInput(error)
    }
}

impl From<&str> for AppError {
    fn from(error: &str) -> Self {
        AppError::InvalidInput(error.to_string())
    }
}

// Convert AppError to String for Tauri commands
impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.to_string()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;