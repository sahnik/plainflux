import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { tauriApi } from '../api/tauri';
import './Help.css';

interface HelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Help: React.FC<HelpProps> = ({ isOpen, onClose }) => {
  const [isGitRepo, setIsGitRepo] = useState(false);
  const [gitLoading, setGitLoading] = useState(false);

  useEffect(() => {
    checkGitStatus();
  }, []);

  const checkGitStatus = async () => {
    try {
      const status = await tauriApi.isGitRepo();
      setIsGitRepo(status);
    } catch (error) {
      console.error('Failed to check git status:', error);
    }
  };

  const initializeGit = async () => {
    setGitLoading(true);
    try {
      await tauriApi.initGitRepo();
      setIsGitRepo(true);
      alert('Git repository initialized successfully! Your notes will now be automatically versioned.');
    } catch (error) {
      console.error('Failed to initialize git:', error);
      alert('Failed to initialize git repository: ' + error);
    } finally {
      setGitLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="help-overlay">
      <div className="help-dialog">
        <div className="help-header">
          <h3>Help</h3>
          <button
            className="help-close-button"
            onClick={onClose}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="help-content">
          <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>Version 0.9.9</p>
      
      <section className="help-section">
        <h2>Git Version Control</h2>
        <div className="feature">
          <h3>📜 Automatic Versioning</h3>
          <p>
            PlainFlux can automatically track changes to your notes using Git. 
            When enabled, changes are automatically committed 5 minutes after the last edit, 
            and you'll see git blame information showing when each line was last modified.
          </p>
          {!isGitRepo ? (
            <button 
              onClick={initializeGit} 
              disabled={gitLoading}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007acc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: gitLoading ? 'not-allowed' : 'pointer',
                marginTop: '10px'
              }}
            >
              {gitLoading ? 'Initializing...' : 'Initialize Git Repository'}
            </button>
          ) : (
            <p style={{ color: 'green', marginTop: '10px' }}>
              ✅ Git repository is active - your notes are being automatically versioned!
            </p>
          )}
        </div>
      </section>
      <section className="help-section">
        <h2>Features</h2>
        
        <div className="feature">
          <h3>📝 Notes</h3>
          <p>Create and organize your notes in a hierarchical folder structure. Notes are saved as Markdown files on your filesystem.</p>
        </div>
        
        <div className="feature">
          <h3>🔗 Backlinks</h3>
          <p>Link between notes using [[Note Name]] syntax. See all notes that link to the current note in the backlinks panel.</p>
        </div>
        
        <div className="feature">
          <h3>🏷️ Tags</h3>
          <p>Add tags to your notes using #tagname syntax. Click on tags to filter notes by tag.</p>
        </div>
        
        <div className="feature">
          <h3>🔍 Search</h3>
          <p>Search through all your notes by content. The search is case-insensitive and finds matches anywhere in the note.</p>
        </div>
        
        <div className="feature">
          <h3>🗓️ Daily Notes</h3>
          <p>Click the calendar icon to create or open today's daily note. Daily notes are automatically organized by date.</p>
        </div>
        
        <div className="feature">
          <h3>🕸️ Knowledge Graph</h3>
          <p>Visualize connections between your notes. Click on nodes to navigate to notes. Double-click a note to see its local graph.</p>
        </div>
        
        <div className="feature">
          <h3>✅ Tasks</h3>
          <p>Create tasks within notes using checkbox syntax. View all incomplete tasks across all notes in the tasks view.</p>
        </div>
        
        <div className="feature">
          <h3>🖼️ Images</h3>
          <p>Paste images directly into notes (Cmd/Ctrl+V). Images are saved in an _attachments folder and automatically linked.</p>
        </div>
      </section>
      
      <section className="help-section">
        <h2>Daily Note Template Variables</h2>
        
        <div className="syntax-item">
          <h3>Available Variables</h3>
          <p>Use these variables in your daily note template (accessible via Settings):</p>
          <pre>{`{{date}}       - Current date (2024-05-26)
{{date_long}}  - Full date (Sunday, May 26, 2024)
{{time}}       - Current time (14:30)
{{datetime}}   - Date and time (2024-05-26 14:30)
{{year}}       - Current year (2024)
{{month}}      - Current month (05)
{{day}}        - Current day (26)
{{weekday}}    - Day of week (Sunday)`}</pre>
        </div>
      </section>
      
      <section className="help-section">
        <h2>Markdown Syntax</h2>
        
        <div className="syntax-item">
          <h3>Headers</h3>
          <pre>{`# H1 Header
## H2 Header
### H3 Header
#### H4 Header
##### H5 Header
###### H6 Header`}</pre>
        </div>
        
        <div className="syntax-item">
          <h3>Emphasis</h3>
          <pre>{`*italic* or _italic_
**bold** or __bold__
***bold italic*** or ___bold italic___
~~strikethrough~~`}</pre>
        </div>
        
        <div className="syntax-item">
          <h3>Lists</h3>
          <pre>{`Unordered:
- Item 1
- Item 2
  - Nested item
* Also works with asterisks

Ordered:
1. First item
2. Second item
   1. Nested item`}</pre>
        </div>
        
        <div className="syntax-item">
          <h3>Tasks</h3>
          <pre>{`- [ ] Incomplete task
- [x] Completed task
* [ ] Also works with asterisks`}</pre>
        </div>
        
        <div className="syntax-item">
          <h3>Links</h3>
          <pre>{`[Link text](https://example.com)
[[Internal note link]]
[[Note link|Custom display text]]`}</pre>
        </div>
        
        <div className="syntax-item">
          <h3>Images</h3>
          <pre>{`![Alt text](image.png)
![Alt text](https://example.com/image.png)`}</pre>
        </div>
        
        <div className="syntax-item">
          <h3>Code</h3>
          <pre>{`Inline code: \`code\`

Code block:
\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\``}</pre>
        </div>
        
        <div className="syntax-item">
          <h3>Blockquotes</h3>
          <pre>{`> This is a blockquote
> 
> > Nested blockquote`}</pre>
        </div>
        
        <div className="syntax-item">
          <h3>Tables</h3>
          <pre>{`| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`}</pre>
        </div>
        
        <div className="syntax-item">
          <h3>Horizontal Rules</h3>
          <pre>{`Three or more...

---
Hyphens

***
Asterisks

___
Underscores`}</pre>
        </div>
      </section>
      
      <section className="help-section">
        <h2>Keyboard Shortcuts</h2>

        <h3>General</h3>
        <div className="shortcut">
          <kbd>Cmd/Ctrl</kbd> + <kbd>E</kbd> - Toggle between edit and preview mode
        </div>

        <div className="shortcut">
          <kbd>Cmd/Ctrl</kbd> + <kbd>S</kbd> - Save note
        </div>

        <div className="shortcut">
          <kbd>Cmd/Ctrl</kbd> + <kbd>V</kbd> - Paste (including images)
        </div>

        <div className="shortcut">
          <kbd>Cmd/Ctrl</kbd> + <kbd>Click</kbd> - Open link in note
        </div>

        <h3>Multi-Cursor Editing</h3>
        <div className="shortcut">
          <kbd>Cmd/Ctrl</kbd> + <kbd>D</kbd> - Select next occurrence of current selection
        </div>

        <div className="shortcut">
          <kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> - Select all occurrences
        </div>

        <h3>Code Folding</h3>
        <div className="shortcut">
          <kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>[</kbd> - Fold current section
        </div>

        <div className="shortcut">
          <kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>]</kbd> - Unfold current section
        </div>

        <div className="shortcut">
          <kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd> <kbd>Cmd/Ctrl</kbd> + <kbd>0</kbd> - Fold all
        </div>

        <div className="shortcut">
          <kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd> <kbd>Cmd/Ctrl</kbd> + <kbd>J</kbd> - Unfold all
        </div>

        <h3>Block References (Headings)</h3>
        <div className="help-section">
          <p>Every heading automatically becomes a linkable block:</p>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '4px', marginTop: '8px', marginBottom: '8px', fontFamily: 'monospace', fontSize: '13px' }}>
            # My Important Section<br/>
            Some content here...<br/><br/>
            ## My Subsection<br/>
            More content...<br/><br/>
            Link to heading: [[Note Name#my-important-section]]<br/>
            Link to subsection: [[Note Name#my-subsection]]
          </div>
          <p>Type [[Note# to see autocomplete for all headings in that note. Clicking a heading link scrolls to and highlights that section.</p>
        </div>
      </section>
        </div>
      </div>
    </div>
  );
};