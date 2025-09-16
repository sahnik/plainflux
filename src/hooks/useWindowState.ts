import { useEffect, useCallback, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { tauriApi } from '../api/tauri';

export function useWindowState() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveWindowState = useCallback(async () => {
    try {
      await tauriApi.saveWindowState();
    } catch (error) {
      console.warn('Failed to save window state:', error);
    }
  }, []);

  const debouncedSaveWindowState = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    timeoutRef.current = setTimeout(() => {
      saveWindowState();
    }, 500); // 500ms debounce
  }, [saveWindowState]);

  useEffect(() => {
    const setupWindowListeners = async () => {
      const appWindow = getCurrentWindow();

      // Listen for window resize events
      const resizeUnlisten = await appWindow.listen('tauri://resize', () => {
        debouncedSaveWindowState();
      });

      // Listen for window move events
      const moveUnlisten = await appWindow.listen('tauri://move', () => {
        debouncedSaveWindowState();
      });

      // Listen for window focus events (to catch maximize/minimize state changes)
      const focusUnlisten = await appWindow.listen('tauri://focus', () => {
        debouncedSaveWindowState();
      });

      // Cleanup function
      return () => {
        resizeUnlisten();
        moveUnlisten();
        focusUnlisten();
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    };

    setupWindowListeners().then((cleanup) => {
      return cleanup;
    });

    // Apply saved window state on mount with a slight delay
    // to ensure the window is fully initialized
    const applyWindowState = async () => {
      try {
        // Small delay to ensure window is ready
        setTimeout(async () => {
          try {
            await tauriApi.applyWindowState();
          } catch (error) {
            console.warn('Failed to apply window state:', error);
          }
        }, 100);
      } catch (error) {
        console.warn('Failed to apply window state:', error);
      }
    };

    applyWindowState();

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [debouncedSaveWindowState]);

  return {
    saveWindowState,
  };
}
