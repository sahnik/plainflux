# Release Notes

## Version 0.9.4 (In Progress)

- **Fix**: Fixed encoding consistency issue where search could find files but fail to read them on Windows. All file operations now use consistent WINDOWS_1252 encoding.
- **Fix**: Daily Notes folder is no longer excluded from search results. Users can now search for content within their daily notes.
- **Fix**: Prevented continuous search re-runs by memoizing search handler and tracking last searched query.
- **Enhancement**: Added comprehensive logging throughout the search system to help diagnose issues.

## Version 0.9.3

- **Fix**: Resolved a critical bug where the search functionality would fail on Windows systems. This was caused by issues handling files with non-UTF8 encodings, which are more common on Windows.
- **Fix**: Corrected a bug where folder paths in the search exclusion logic were being compared case-sensitively, which caused folders like `Daily Notes` to be incorrectly included in searches on case-insensitive filesystems like Windows.
