interface PlaygamaBridge {
  initialize?: () => Promise<void>;
  platform?: {
    sendMessage?: (message: string) => void;
    id?: string;
  };
  game?: {
    on?: (event: string, cb: (state: string) => void) => void;
  };
}

declare global {
  interface Window {
    bridge?: PlaygamaBridge;
  }
}

let initialized = false;

export async function initPlaygamaBridge(
  onVisibilityChange?: (hidden: boolean) => void,
): Promise<void> {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  try {
    if (window.bridge?.initialize) {
      await window.bridge.initialize();
    }
    window.bridge?.platform?.sendMessage?.('game_ready');
    window.bridge?.game?.on?.('visibility_state_changed', (state: string) => {
      if (onVisibilityChange) {
        onVisibilityChange(state === 'hidden');
      }
    });
  } catch {
    // Running standalone in standard browser without Playgama host container
  }
}

export function signalPlaygamaGameplayStart(): void {
  try {
    window.bridge?.platform?.sendMessage?.('gameplay_started');
  } catch {
    // No-op outside Playgama host
  }
}
