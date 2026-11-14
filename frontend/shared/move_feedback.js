/**
 * #34: DroidFish-style "Move sound" and "Enable Vibration": a short click
 * and buzz when an engine moves, so you can look away while it thinks.
 * The sound is a 60 ms WebAudio blip (no audio asset to ship).
 */
import { DrawerKeys, drawerToggle } from './settings_drawer.js';

let audioCtx = null;

function click() {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(330, t + 0.06);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
}

/** Call for each new move; `byEngine` says whether an engine played it. */
export function moveFeedback(byEngine) {
    if (!byEngine) return;
    try {
        if (drawerToggle(DrawerKeys.moveSound)) click();
        if (drawerToggle(DrawerKeys.vibrate)) globalThis.navigator?.vibrate?.(35);
    } catch { /* feedback is best-effort */ }
}
