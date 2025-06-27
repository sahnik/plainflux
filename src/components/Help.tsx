import React from 'react';
import './Help.css';

export const Help: React.FC = () => {
  return (
    <div className="help-container">
      <h1>Help</h1>
      <p>Version 0.9.3</p>
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
      </section>
    </div>
  );
};