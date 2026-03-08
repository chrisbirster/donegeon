let swRegistrationStarted = false;

export function registerAppServiceWorker() {
  if (swRegistrationStarted) return;
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  const enableInDev = window.localStorage.getItem("donegeon.enable_pwa_dev") === "1";
  if (import.meta.env.DEV && !enableInDev) return;

  swRegistrationStarted = true;
  void navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    })
    .catch((error) => {
      console.warn("[pwa] service worker registration failed", error);
    });
}
