use git2::{Repository, Signature, IndexAddOption};
use std::path::Path;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::{Duration, Instant};
use chrono::Local;
use tokio::time::sleep;

pub struct GitManager {
    repo: Option<Repository>,
    notes_dir: String,
    last_change: Arc<StdMutex<Option<Instant>>>,
    commit_task_running: Arc<StdMutex<bool>>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct GitBlameInfo {
    pub line_number: usize,
    pub commit_hash: String,
    pub author: String,
    pub timestamp: i64,
    pub summary: String,
}

impl GitManager {
    pub fn new(notes_dir: &str) -> Self {
        let repo = Repository::discover(notes_dir).ok();
        Self {
            repo,
            notes_dir: notes_dir.to_string(),
            last_change: Arc::new(StdMutex::new(None)),
            commit_task_running: Arc::new(StdMutex::new(false)),
        }
    }

    pub fn is_git_repo(&self) -> bool {
        self.repo.is_some()
    }

    pub fn init_repo(&mut self) -> Result<(), String> {
        if self.repo.is_some() {
            return Ok(());
        }

        match Repository::init(&self.notes_dir) {
            Ok(repo) => {
                self.repo = Some(repo);
                Ok(())
            }
            Err(e) => Err(format!("Failed to initialize git repository: {}", e)),
        }
    }

    pub fn commit_changes(&self, message: Option<&str>) -> Result<(), String> {
        let repo = match &self.repo {
            Some(repo) => repo,
            None => return Err("No git repository available".to_string()),
        };

        // Add all markdown files to the index
        let mut index = repo.index().map_err(|e| format!("Failed to get index: {}", e))?;
        
        // Add all .md files
        index.add_all(["*.md"].iter(), IndexAddOption::DEFAULT, None)
            .map_err(|e| format!("Failed to add files: {}", e))?;
        
        // Write the index
        index.write().map_err(|e| format!("Failed to write index: {}", e))?;

        // Check if there are any changes to commit
        let tree_id = index.write_tree().map_err(|e| format!("Failed to write tree: {}", e))?;
        let tree = repo.find_tree(tree_id).map_err(|e| format!("Failed to find tree: {}", e))?;

        // Get the HEAD commit
        let parent_commit = match repo.head() {
            Ok(head) => {
                let oid = head.target().ok_or("Failed to get HEAD target")?;
                Some(repo.find_commit(oid).map_err(|e| format!("Failed to find HEAD commit: {}", e))?)
            }
            Err(_) => None, // First commit
        };

        // Check if tree is different from HEAD
        if let Some(ref parent) = parent_commit {
            let parent_tree = parent.tree().map_err(|e| format!("Failed to get parent tree: {}", e))?;
            if parent_tree.id() == tree.id() {
                // No changes to commit
                return Ok(());
            }
        }

        // Create signature
        let signature = Signature::now("PlainFlux Auto-commit", "auto@plainflux.local")
            .map_err(|e| format!("Failed to create signature: {}", e))?;

        // Create commit message
        let default_message = format!("Auto-commit: {}", Local::now().format("%Y-%m-%d %H:%M:%S"));
        let commit_message = message.unwrap_or(&default_message);

        // Create the commit
        let parents: Vec<&git2::Commit> = parent_commit.as_ref().map_or(vec![], |c| vec![c]);
        
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            commit_message,
            &tree,
            &parents,
        ).map_err(|e| format!("Failed to create commit: {}", e))?;

        Ok(())
    }

    pub fn get_blame_info(&self, file_path: &str) -> Result<Vec<GitBlameInfo>, String> {
        let repo = match &self.repo {
            Some(repo) => repo,
            None => return Err("No git repository available".to_string()),
        };

        // Convert absolute path to relative path from repo root
        let repo_path = repo.workdir().ok_or("Repository has no working directory")?;
        let file_path_buf = Path::new(file_path);
        let relative_path = file_path_buf.strip_prefix(repo_path)
            .map_err(|_| "File is not in repository")?;

        // Get the blame for the file
        let blame = repo.blame_file(relative_path, None)
            .map_err(|e| format!("Failed to get blame info: {}", e))?;

        let mut blame_info = Vec::new();

        for line_num in 0..blame.len() {
            if let Some(hunk) = blame.get_line(line_num + 1) {
                let commit_oid = hunk.final_commit_id();
                let commit = repo.find_commit(commit_oid)
                    .map_err(|e| format!("Failed to find commit: {}", e))?;

                let author = commit.author();
                let timestamp = author.when().seconds();
                let summary = commit.summary().unwrap_or("").to_string();

                blame_info.push(GitBlameInfo {
                    line_number: line_num + 1,
                    commit_hash: commit_oid.to_string()[..8].to_string(), // Short hash
                    author: author.name().unwrap_or("Unknown").to_string(),
                    timestamp,
                    summary,
                });
            }
        }

        Ok(blame_info)
    }

    pub fn schedule_auto_commit(&self) {
        // Update the last change timestamp
        if let Ok(mut last_change) = self.last_change.lock() {
            *last_change = Some(Instant::now());
        }

        // Start the debounced commit task if it's not already running
        let task_running = self.commit_task_running.clone();
        let last_change = self.last_change.clone();
        let notes_dir = self.notes_dir.clone();
        
        let should_start_task = {
            if let Ok(mut running) = task_running.lock() {
                if !*running {
                    *running = true;
                    true
                } else {
                    false
                }
            } else {
                false
            }
        };
        
        if should_start_task {
            // Spawn the debounced commit task
            tokio::spawn(async move {
                Self::debounced_commit_task(last_change, notes_dir, task_running).await;
            });
        }
    }

    async fn debounced_commit_task(
        last_change: Arc<StdMutex<Option<Instant>>>,
        notes_dir: String,
        task_running: Arc<StdMutex<bool>>,
    ) {
        const COMMIT_DELAY: Duration = Duration::from_secs(5 * 60); // 5 minutes
        
        loop {
            sleep(Duration::from_secs(30)).await; // Check every 30 seconds
            
            let should_commit = {
                if let Ok(last_change_guard) = last_change.lock() {
                    if let Some(last_time) = *last_change_guard {
                        last_time.elapsed() >= COMMIT_DELAY
                    } else {
                        false
                    }
                } else {
                    false
                }
            };
            
            if should_commit {
                // Clear the last change timestamp
                if let Ok(mut last_change_guard) = last_change.lock() {
                    *last_change_guard = None;
                }
                
                // Perform the commit
                let temp_manager = GitManager::new(&notes_dir);
                if temp_manager.is_git_repo() {
                    if let Err(e) = temp_manager.commit_changes(None) {
                        eprintln!("Auto-commit failed: {}", e);
                    } else {
                        println!("Auto-commit completed at {}", Local::now().format("%Y-%m-%d %H:%M:%S"));
                    }
                }
                
                // Mark task as not running and exit
                if let Ok(mut running) = task_running.lock() {
                    *running = false;
                }
                break;
            }
        }
    }
}