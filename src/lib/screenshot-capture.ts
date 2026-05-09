import html2canvas from "html2canvas";
import { getSessionId } from "@/lib/session-manager";

const CONSENT_KEY = "siskeudes_screen_share_consent";

export function hasScreenShareConsent(): boolean {
  return localStorage.getItem(CONSENT_KEY) === "true";
}

export function setScreenShareConsent(consent: boolean) {
  localStorage.setItem(CONSENT_KEY, consent ? "true" : "false");
}

let captureInterval: ReturnType<typeof setInterval> | null = null;

export async function captureAndUpload() {
  if (!hasScreenShareConsent()) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  
  try {
    const canvas = await html2canvas(document.body, {
      scale: 0.5,
      useCORS: true,
      logging: false,
      width: window.innerWidth,
      height: window.innerHeight,
    });
    
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.6);
    });
    
    const sessionId = getSessionId();
    const fileName = `${sessionId}/latest.jpg`;
    
    // Convert blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]); // remove data:image/jpeg;base64,
      };
      reader.readAsDataURL(blob);
    });
    
    const fileBase64 = await base64Promise;

    await fetch("/api/storage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName,
        fileBase64,
        contentType: "image/jpeg",
      }),
    });
  } catch {
    // Silent fail
  }
}

export function startScreenCapture(intervalMs = 15000) {
  if (captureInterval) return;
  if (!hasScreenShareConsent()) return;
  
  captureAndUpload();
  captureInterval = setInterval(captureAndUpload, intervalMs);
}

export function stopScreenCapture() {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
}

export function getScreenshotUrl(sessionId: string): string {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return `${url}/storage/v1/object/public/screenshots/${sessionId}/latest.jpg`;
}
