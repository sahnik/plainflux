/// Macro for safely locking a mutex with poisoning recovery
#[macro_export]
macro_rules! lock_mutex {
    ($mutex:expr) => {
        match $mutex.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("Warning: Mutex was poisoned, recovering...");
                poisoned.into_inner()
            }
        }
    };
    ($mutex:expr, $error_msg:expr) => {
        match $mutex.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("Warning: {error_msg}", error_msg = $error_msg);
                poisoned.into_inner()
            }
        }
    };
}
