export function registerCoiServiceWorker(): void {
  if (typeof window === 'undefined') {
    return
  }

  if (!window.isSecureContext) {
    return
  }

  if (!('serviceWorker' in navigator)) {
    return
  }

  navigator.serviceWorker.register(import.meta.env.BASE_URL + '/coi-serviceworker.js').catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : 'Unknown registration error'
    console.error(`Failed to register COI service worker: ${detail}`)
  })
}
