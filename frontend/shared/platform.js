/**
 * Where is this frontend running?
 *
 * The same files ship to the website (with a Python backend at /api) and to
 * the Android app (packaged assets, no network). Android loads
 * play.html?platform=android and exposes window.AndroidApp.
 */
export function isOfflineApp() {
    if (typeof window === 'undefined') return false;
    if (window.AndroidApp) return true;
    try {
        return new URLSearchParams(window.location?.search || '').get('platform') === 'android';
    } catch {
        return false;
    }
}
