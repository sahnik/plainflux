import { EditorView } from '@codemirror/view';
import { tauriApi } from '../api/tauri';

// File type detection utility
export function getFileTypeFromExtension(filename: string): {
  type: 'image' | 'document' | 'spreadsheet' | 'presentation' | 'pdf' | 'other';
  icon: string;
} {
  const extension = filename.toLowerCase().split('.').pop() || '';

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  const documentExts = ['doc', 'docx', 'odt', 'rtf', 'txt'];
  const spreadsheetExts = ['xls', 'xlsx', 'ods', 'csv'];
  const presentationExts = ['ppt', 'pptx', 'odp'];
  const pdfExts = ['pdf'];

  if (imageExts.includes(extension)) {
    return { type: 'image', icon: '🖼️' };
  } else if (documentExts.includes(extension)) {
    return { type: 'document', icon: '📄' };
  } else if (spreadsheetExts.includes(extension)) {
    return { type: 'spreadsheet', icon: '📊' };
  } else if (presentationExts.includes(extension)) {
    return { type: 'presentation', icon: '📽️' };
  } else if (pdfExts.includes(extension)) {
    return { type: 'pdf', icon: '📑' };
  } else {
    return { type: 'other', icon: '📎' };
  }
}

export function createPasteHandler(notePath: string | undefined) {
  return EditorView.domEventHandlers({
    paste: (event, view) => {
      if (!notePath) return false;

      const clipboardData = event.clipboardData;
      if (!clipboardData) return false;

      // Check if clipboard contains files
      const items = Array.from(clipboardData.items);
      const fileItems = items.filter(item => item.kind === 'file');

      if (fileItems.length > 0) {
        event.preventDefault();

        fileItems.forEach(async (item, index) => {
          const file = item.getAsFile();
          if (!file) return;

          try {
            const buffer = await file.arrayBuffer();
            const fileData = new Uint8Array(buffer);
            const fileType = getFileTypeFromExtension(file.name);

            let filePath: string;
            let markdownSyntax: string;

            if (fileType.type === 'image') {
              // Use existing image handler for images
              filePath = await tauriApi.saveImage(fileData, file.name, notePath);
              markdownSyntax = `![${file.name}](${filePath})`;
            } else {
              // Use new attachment handler for other files
              filePath = await tauriApi.saveAttachment(fileData, file.name, notePath);
              markdownSyntax = `[${fileType.icon} ${file.name}](${filePath})`;
            }

            // Insert at cursor position
            const pos = view.state.selection.main.head;
            const insertText = index < fileItems.length - 1 ? `${markdownSyntax}\n` : markdownSyntax;

            view.dispatch({
              changes: { from: pos, to: pos, insert: insertText },
              selection: { anchor: pos + insertText.length }
            });
          } catch (error) {
            console.error('Failed to save file:', error);
          }
        });

        return true;
      }

      // Fallback to original image handling for backward compatibility
      const imageItem = items.find(item => item.type.startsWith('image/'));

      if (imageItem) {
        event.preventDefault();

        imageItem.getAsFile()?.arrayBuffer().then(async (buffer) => {
          try {
            // Generate filename with timestamp
            const timestamp = new Date().getTime();
            const extension = imageItem.type.split('/')[1] || 'png';
            const filename = `pasted-image-${timestamp}.${extension}`;

            // Convert ArrayBuffer to Uint8Array
            const imageData = new Uint8Array(buffer);

            // Save image to backend
            const imagePath = await tauriApi.saveImage(imageData, filename, notePath);

            // Insert markdown image syntax at cursor position
            const pos = view.state.selection.main.head;
            const imageMarkdown = `![${filename}](${imagePath})`;

            view.dispatch({
              changes: { from: pos, to: pos, insert: imageMarkdown },
              selection: { anchor: pos + imageMarkdown.length }
            });
          } catch (error) {
            console.error('Failed to save image:', error);
          }
        });

        return true;
      }

      return false;
    },

    drop: (event, view) => {
      if (!notePath) return false;

      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) return false;

      // Check if dropping files
      const files = Array.from(dataTransfer.files);

      if (files.length > 0) {
        event.preventDefault();

        // Get drop position
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) || view.state.selection.main.head;

        // Process each file
        files.forEach(async (file, index) => {
          try {
            const buffer = await file.arrayBuffer();
            const fileData = new Uint8Array(buffer);
            const fileType = getFileTypeFromExtension(file.name);

            let filePath: string;
            let markdownSyntax: string;

            if (fileType.type === 'image') {
              // Use existing image handler for images
              filePath = await tauriApi.saveImage(fileData, file.name, notePath);
              markdownSyntax = `![${file.name}](${filePath})`;
            } else {
              // Use new attachment handler for other files
              filePath = await tauriApi.saveAttachment(fileData, file.name, notePath);
              markdownSyntax = `[${fileType.icon} ${file.name}](${filePath})`;
            }

            // Insert markdown syntax
            const insertText = index < files.length - 1 ? `${markdownSyntax}\n` : markdownSyntax;

            view.dispatch({
              changes: {
                from: pos + (index > 0 ? 1 : 0),
                to: pos + (index > 0 ? 1 : 0),
                insert: insertText
              }
            });
          } catch (error) {
            console.error('Failed to save file:', error);
          }
        });

        return true;
      }

      return false;
    }
  });
}