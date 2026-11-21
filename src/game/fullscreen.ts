interface FullscreenDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msFullscreenEnabled?: boolean;
  msFullscreenElement?: Element | null;
  msExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  return true;
}

export function isNativeFullscreenAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  const el = document.documentElement as FullscreenElement;
  const enabledFlag =
    doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? doc.msFullscreenEnabled;
  if (enabledFlag === false) return false;
  return Boolean(
    el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen,
  );
}

export function isDocumentFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  return Boolean(
    doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement,
  );
}

async function tryRequestFullscreenOnElement(el: FullscreenElement): Promise<boolean> {
  try {
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' });
      } catch {
        await el.requestFullscreen();
      }
      if (isDocumentFullscreen()) return true;
    }
    if (el.webkitRequestFullscreen) {
      await Promise.resolve(el.webkitRequestFullscreen());
      await new Promise((r) => setTimeout(r, 40));
      if (isDocumentFullscreen()) return true;
    }
    if (el.msRequestFullscreen) {
      await Promise.resolve(el.msRequestFullscreen());
      await new Promise((r) => setTimeout(r, 40));
      if (isDocumentFullscreen()) return true;
    }
  } catch {
    // Blocked by iframe permissions or browser policy
  }
  return false;
}

export async function enterFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (isDocumentFullscreen()) return true;
  if (!isNativeFullscreenAvailable()) return false;

  const docEl = document.documentElement as FullscreenElement;
  if (await tryRequestFullscreenOnElement(docEl)) return true;

  const bodyEl = document.body as FullscreenElement | null;
  if (bodyEl && (await tryRequestFullscreenOnElement(bodyEl))) return true;

  return false;
}

export async function exitFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  if (!isDocumentFullscreen()) return;

  const doc = document as FullscreenDocument;
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await Promise.resolve(doc.webkitExitFullscreen());
    } else if (doc.msExitFullscreen) {
      await Promise.resolve(doc.msExitFullscreen());
    }
  } catch {
    // Ignore errors when exiting fullscreen
  }
}
