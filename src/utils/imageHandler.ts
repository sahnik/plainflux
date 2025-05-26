import { EditorView } from '@codemirror/view';
import { tauriApi } from '../api/tauri';

export function createPasteHandler(notePath: string | undefined) {
  return EditorView.domEventHandlers({
    paste: (event, view) => {
      if (!notePath) return false;
      
      const clipboardData = event.clipboardData;
      if (!clipboardData) return false;
      
      // Check if clipboard contains image
      const items = Array.from(clipboardData.items);
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
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      
      if (imageFiles.length > 0) {
        event.preventDefault();
        
        // Get drop position
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) || view.state.selection.main.head;
        
        // Process each image
        imageFiles.forEach(async (file, index) => {
          try {
            const buffer = await file.arrayBuffer();
            const imageData = new Uint8Array(buffer);
            
            // Save image to backend
            const imagePath = await tauriApi.saveImage(imageData, file.name, notePath);
            
            // Insert markdown image syntax
            const imageMarkdown = `![${file.name}](${imagePath})${index < imageFiles.length - 1 ? '\n' : ''}`;
            
            view.dispatch({
              changes: { 
                from: pos + (index > 0 ? 1 : 0), 
                to: pos + (index > 0 ? 1 : 0), 
                insert: imageMarkdown 
              }
            });
          } catch (error) {
            console.error('Failed to save image:', error);
          }
        });
        
        return true;
      }
      
      return false;
    }
  });
}