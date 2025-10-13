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
          <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>Version 0.9.10</p>
      
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
          <p>Create and manage tasks within notes with powerful filtering, sorting, and metadata support.</p>
          <ul style={{ marginTop: '8px', marginLeft: '20px', color: 'var(--text-secondary)' }}>
            <li>View all tasks across notes in the tasks panel</li>
            <li>Add priorities: !high, !medium, !low or p:1, p:2, p:3</li>
            <li>Set due dates: @due(2025-01-15), due:2025-01-15, or 📅 2025-01-15</li>
            <li>Add tags with #tagname for organization</li>
            <li>Filter by completion, date, priority, or tags</li>
            <li>Sort by note, due date, priority, or alphabetically</li>
            <li>Click any task to jump to its location in the note</li>
          </ul>
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
          <pre>{`Basic tasks:
- [ ] Incomplete task
- [x] Completed task
* [ ] Also works with asterisks

With priorities:
- [ ] Critical bug fix !high
- [ ] Review documentation !medium
- [ ] Clean up code p:3

With due dates:
- [ ] Submit report @due(2025-01-15)
- [ ] Team meeting due:2025-01-20
- [ ] Dentist appointment 📅 2025-01-18

Combined:
- [ ] Launch feature !high @due(2025-01-15) #work
- [ ] Buy groceries p:2 due:2025-01-16 #personal
- [x] Completed task with metadata !low #done`}</pre>
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
        <h2>Task Management</h2>

        <div className="syntax-item">
          <h3>Priority Levels</h3>
          <p>Add priorities to tasks using these formats:</p>
          <pre>{`!high or p:1    - High priority (red/orange)
!medium or p:2  - Medium priority (yellow)
!low or p:3     - Low priority (green)

Examples:
- [ ] Fix security vulnerability !high
- [ ] Update dependencies p:2
- [ ] Refactor old code !low`}</pre>
        </div>

        <div className="syntax-item">
          <h3>Due Dates</h3>
          <p>Set due dates using any of these formats:</p>
          <pre>{`@due(2025-01-15)  - Function style
due:2025-01-15    - Colon separated
📅 2025-01-15     - Calendar emoji

Examples:
- [ ] Submit quarterly report @due(2025-01-31)
- [ ] Doctor appointment due:2025-01-20
- [ ] Birthday party 📅 2025-02-14`}</pre>
          <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            • Overdue tasks are highlighted in red with a pulsing indicator<br/>
            • Tasks due today/tomorrow show friendly labels<br/>
            • Click any task to jump directly to its line in the note
          </p>
        </div>

        <div className="syntax-item">
          <h3>Recurring Tasks</h3>
          <p>Create recurring tasks that automatically recreate themselves when completed:</p>
          <pre>{`@every(Monday)    - Repeats every Monday
@every(Tuesday)   - Repeats every Tuesday
@every(Wednesday) - Repeats every Wednesday
@every(Thursday)  - Repeats every Thursday
@every(Friday)    - Repeats every Friday
@every(Saturday)  - Repeats every Saturday
@every(Sunday)    - Repeats every Sunday

@repeat(daily)    - Repeats every day
@repeat(weekly)   - Repeats every 7 days
@repeat(monthly)  - Repeats monthly (same day)

Examples:
- [ ] Team standup @every(Monday) !high
- [ ] Review metrics @repeat(weekly) #analytics
- [ ] Take vitamins @repeat(daily) #health
- [ ] Weekly planning @every(Friday) @due(2025-10-17)`}</pre>
          <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            <strong>How it works:</strong><br/>
            • Recurring tasks display a cyan repeat icon badge<br/>
            • When you mark a recurring task as complete, a new uncompleted instance is automatically created<br/>
            • The new instance appears in today's daily note with an updated due date<br/>
            • All metadata (priority, tags, recurrence pattern) is preserved<br/>
            • Next due date is calculated based on the pattern (e.g., next Monday for @every(Monday))
          </p>
          <p style={{ marginTop: '8px', color: 'var(--accent-color)', fontSize: '14px', fontStyle: 'italic' }}>
            <strong>Example workflow:</strong> Complete "Team standup @every(Monday)" on Monday → New instance created in today's daily note with @due(next Monday)
          </p>
        </div>

        <div className="syntax-item">
          <h3>Subtasks & Nested Todos</h3>
          <p>Create hierarchical task structures using indentation (2 spaces = 1 level):</p>
          <pre>{`- [ ] Main project task !high
  - [ ] Subtask 1
  - [ ] Subtask 2
    - [ ] Sub-subtask 2.1
  - [ ] Subtask 3

- [ ] Another parent task
  - [ ] Child task @due(2025-10-15)
  - [ ] Another child task #tag`}</pre>
          <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            <strong>Features:</strong><br/>
            • Visual connector lines show parent-child relationships<br/>
            • Parent tasks display subtask progress (e.g., "2/5 subtasks completed")<br/>
            • Supports unlimited nesting depth<br/>
            • Each subtask can have its own priority, due date, and tags<br/>
            • Indentation is automatically detected and rendered hierarchically
          </p>
        </div>

        <div className="syntax-item">
          <h3>Filtering & Sorting</h3>
          <p>In the Tasks panel, you can:</p>
          <ul style={{ marginLeft: '20px', color: 'var(--text-secondary)' }}>
            <li><strong>Filter by status:</strong> All, Incomplete, or Completed</li>
            <li><strong>Filter by date:</strong> All, Overdue, Today, This Week, or No Date</li>
            <li><strong>Filter by priority:</strong> All, High, Medium, Low, or No Priority</li>
            <li><strong>Filter by tags:</strong> Click tag buttons to filter by specific tags</li>
            <li><strong>Search:</strong> Search task content in real-time</li>
            <li><strong>Sort options:</strong> By Note, Due Date, Priority, A-Z, or Status</li>
          </ul>
        </div>

        <div className="syntax-item">
          <h3>Complete Example with All Features</h3>
          <pre>{`## Work Tasks
- [ ] Q4 Planning !high @due(2025-01-15) #strategy
  - [ ] Review budget proposals !medium #finance
  - [ ] Schedule team meetings @due(2025-01-12)
  - [ ] Draft presentation slides
    - [ ] Create charts and graphs
    - [ ] Add speaker notes

- [ ] Deploy to production !high @due(2025-01-15) #devops #urgent
- [ ] Code review for PR #123 !medium due:2025-01-16 #review
- [ ] Team standup @every(Monday) !high #meetings
- [ ] Weekly report @repeat(weekly) @due(2025-01-19) #admin
- [x] Fix login bug !high @due(2025-01-10) #bugfix

## Personal
- [ ] Renew passport due:2025-02-01 #admin
- [ ] Gym workout @repeat(daily) #health
- [ ] Weekly meal prep @every(Sunday) !low
- [ ] Call mom !medium #family`}</pre>
          <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            This example showcases: priorities (!high, !medium, !low), due dates (@due, due:, 📅),
            recurring tasks (@every, @repeat), nested subtasks (indentation), tags (#tag), and completion status.
          </p>
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

        <h3>Tasks</h3>
        <div className="shortcut">
          <kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd> - Quick add todo (creates new task in current note)
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

        <h3>Transclusion (Embed Content) - Preview Only</h3>
        <div className="help-section">
          <p>Embed content from other notes using <code>![[...]]</code> syntax. Transclusions are rendered in <strong>preview mode</strong> only:</p>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '4px', marginTop: '8px', marginBottom: '8px', fontFamily: 'monospace', fontSize: '13px' }}>
            {/* Embed entire note */}
            ![[Meeting Notes]]<br/><br/>

            {/* Embed specific section */}
            ![[Project Plan#goals]]<br/><br/>

            {/* Embed subsection */}
            ![[Documentation#installation-guide]]
          </div>
          <p>
            In edit mode, you'll see the raw <code>![[...]]</code> syntax.
            Switch to preview mode (Cmd/Ctrl+E) to see the embedded content rendered as a blockquote.
            Click the arrow (→) link to navigate to the source note.
          </p>
          <ul>
            <li><code>![[Note Name]]</code> - Embeds the entire note</li>
            <li><code>![[Note Name#heading]]</code> - Embeds just that heading and its content</li>
            <li>Note: Transclusions only appear in preview mode, not while editing</li>
          </ul>
        </div>
      </section>
        </div>
      </div>
    </div>
  );
};