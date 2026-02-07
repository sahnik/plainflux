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
    const appWindow = getCurrentWindow();
    let isDisposed = false;
    let listenersCleanup: (() => void) | null = null;

    const setupWindowListeners = async () => {
      try {
        const [resizeUnlisten, moveUnlisten, focusUnlisten] = await Promise.all([
          appWindow.listen('tauri://resize', () => {
            debouncedSaveWindowState();
          }),
          appWindow.listen('tauri://move', () => {
            debouncedSaveWindowState();
          }),
          appWindow.listen('tauri://focus', () => {
            debouncedSaveWindowState();
          }),
        ]);

        const cleanup = () => {
          resizeUnlisten();
          moveUnlisten();
          focusUnlisten();
        };

        if (isDisposed) {
          cleanup();
          return;
        }

        listenersCleanup = cleanup;
      } catch (error) {
        console.warn('Failed to setup window listeners:', error);
      }
    };

    void setupWindowListeners();

    const applyWindowStateTimer = setTimeout(() => {
      tauriApi.applyWindowState().catch((error) => {
        console.warn('Failed to apply window state:', error);
      });
    }, 100);

    // Cleanup on unmount
    return () => {
      isDisposed = true;
      clearTimeout(applyWindowStateTimer);
      if (listenersCleanup) {
        listenersCleanup();
        listenersCleanup = null;
      }
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
