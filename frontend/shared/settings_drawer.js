/**
 * Slide-out settings drawer: one place for the knobs that were scattered
 * across the page (or only reachable from /admin). It never owns state the
 * page already has: strength, theme and board rotation are *proxied* to the
 * existing controls (so their handlers, hints and persistence still run);
 * new toggles are plain localStorage keys read where they apply.
 */
import { SettingsKeys, getSettings, setNum, setSideEngine, sideEngineSettings } from './settings_store.js';
import { idForStartFen, randomShatrunz960Id, startFenFor } from './shatrunz960.js';
import { STANDARD_START, boardToStartFen, getStartFen, setStartFen, validateStartFen } from './start_position.js';

export const DrawerKeys = {
    animations: 'shatrunz_animations',
    engineLine: 'shatrunz_show_engine_line',
    captured: 'shatrunz_show_captured',
    // #34: DroidFish-style board preferences (DroidFish key names in comments).
    squareLabels: 'shatrunz_square_labels',     // drawSquareLabels
    highlightLastMove: 'shatrunz_highlight_last', // highlightLastMove
    blindMode: 'shatrunz_blind_mode',           // blindMode
    autoSwapSides: 'shatrunz_auto_swap_sides',  // autoSwapSides ("Flip Board: Auto")
    moveSound: 'shatrunz_move_sound',           // moveSoundEnabled
    vibrate: 'shatrunz_vibrate',                // vibrateEnabled
};

/** Toggles off by default (everything else defaults on). */
const DEFAULT_OFF = new Set([DrawerKeys.blindMode, DrawerKeys.autoSwapSides, DrawerKeys.moveSound, DrawerKeys.vibrate]);

/** '1' = on, '0' = off, unset = the toggle's default. */
export function drawerToggle(key) {
    try {
        const v = localStorage.getItem(key);
        return v === null ? !DEFAULT_OFF.has(key) : v !== '0';
    } catch { return !DEFAULT_OFF.has(key); }
}

const TOGGLE_IDS = [
    [DrawerKeys.animations, 'drawer-animations'], [DrawerKeys.engineLine, 'drawer-engine-line'],
    [DrawerKeys.captured, 'drawer-captured'], [DrawerKeys.squareLabels, 'drawer-square-labels'],
    [DrawerKeys.highlightLastMove, 'drawer-highlight-last'], [DrawerKeys.blindMode, 'drawer-blind'],
    [DrawerKeys.autoSwapSides, 'drawer-auto-swap'], [DrawerKeys.moveSound, 'drawer-move-sound'],
    [DrawerKeys.vibrate, 'drawer-vibrate'],
];

const THINK_TIMES = [[0, 'Auto (by strength)'], [250, '0.25 s'], [500, '0.5 s'], [1000, '1 s'], [2000, '2 s'], [5000, '5 s']];

function applyBodyToggles() {
    document.body.classList.toggle('hide-engine-line', !drawerToggle(DrawerKeys.engineLine));
    document.body.classList.toggle('hide-captured', !drawerToggle(DrawerKeys.captured));
    document.body.classList.toggle('hide-square-labels', !drawerToggle(DrawerKeys.squareLabels));
    document.body.classList.toggle('no-last-move-highlight', !drawerToggle(DrawerKeys.highlightLastMove));
    document.body.classList.toggle('blindfold', drawerToggle(DrawerKeys.blindMode));
}

function proxy(id, value, events = ['input', 'change']) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(value);
    for (const e of events) el.dispatchEvent(new Event(e, { bubbles: true }));
}

export function initSettingsDrawer() {
    const drawer = document.getElementById('settings-drawer');
    const openBtn = document.getElementById('settings-open');
    if (!drawer || !openBtn) return;
    const scrim = document.getElementById('settings-scrim');
    const level = document.getElementById('drawer-ai-level');
    const levelOut = document.getElementById('drawer-ai-level-label');
    const think = document.getElementById('drawer-think-time');
    const theme = document.getElementById('drawer-theme');

    think.innerHTML = THINK_TIMES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

    // #33: per-side overrides; value "" = same as global.
    for (const side of ['w', 'b']) {
        const lv = document.getElementById(`drawer-${side}-level`);
        const th = document.getElementById(`drawer-${side}-think`);
        if (!lv || !th) continue;
        lv.innerHTML = '<option value="">Same</option>' + [1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}">${n}</option>`).join('');
        th.innerHTML = '<option value="">Same</option>' + THINK_TIMES.filter(([v]) => v > 0).map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
        const cur = sideEngineSettings(side);
        lv.value = cur.level ? String(cur.level) : '';
        th.value = cur.thinkTimeMs && THINK_TIMES.some(([v]) => v === cur.thinkTimeMs) ? String(cur.thinkTimeMs) : '';
        lv.addEventListener('change', () => setSideEngine(side, 'level', Number(lv.value) || 0));
        th.addEventListener('change', () => setSideEngine(side, 'thinkTimeMs', Number(th.value) || 0));
    }

    const sync = () => {
        const pageLevel = document.getElementById('ai-level')?.value || getSettings().aiLevel || 3;
        level.value = String(pageLevel);
        levelOut.textContent = String(pageLevel);
        think.value = String(THINK_TIMES.some(([v]) => v === getSettings().thinkTimeMs) ? getSettings().thinkTimeMs : 0);
        theme.value = document.getElementById('board-theme')?.value || 'classic';
        for (const [key, id] of TOGGLE_IDS) {
            document.getElementById(id).checked = drawerToggle(key);
        }
        document.getElementById('drawer-flip').setAttribute('aria-pressed',
            document.getElementById('board-flip')?.getAttribute('aria-pressed') || 'false');
    };
    const setOpen = (open) => {
        if (open) sync();
        drawer.classList.toggle('open', open);
        drawer.setAttribute('aria-hidden', String(!open));
        openBtn.setAttribute('aria-expanded', String(open));
        if (scrim) scrim.hidden = !open;
        if (open) drawer.querySelector('button, input, select')?.focus();
        else openBtn.focus();
    };

    openBtn.addEventListener('click', () => setOpen(!drawer.classList.contains('open')));
    document.getElementById('settings-close')?.addEventListener('click', () => setOpen(false));
    scrim?.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('open')) setOpen(false); });

    level.addEventListener('input', () => { levelOut.textContent = level.value; });
    level.addEventListener('change', () => proxy('ai-level', level.value));
    think.addEventListener('change', () => setNum(SettingsKeys.thinkTimeMs, Number(think.value)));
    theme.addEventListener('change', () => proxy('board-theme', theme.value, ['change']));
    document.getElementById('drawer-flip').addEventListener('click', () => {
        document.getElementById('board-flip')?.click();
        sync();
    });
    for (const [key, id] of TOGGLE_IDS) {
        document.getElementById(id).addEventListener('change', (e) => {
            localStorage.setItem(key, e.target.checked ? '1' : '0');
            applyBodyToggles();
            window.dispatchEvent(new Event('shatrunz:settings')); // e.g. auto-flip re-render
        });
    }
    // Start position (#30): validated by the Rust rules before it's saved.
    const fenEl = document.getElementById('drawer-start-fen');
    const fenErr = document.getElementById('drawer-start-error');
    if (fenEl) {
        fenEl.value = getStartFen() || STANDARD_START;
        const label960 = document.getElementById('drawer-960-label');
        const id960 = document.getElementById('drawer-960-id');
        const showLabel = () => {
            const id = idForStartFen(getStartFen() || STANDARD_START);
            if (label960) label960.textContent = id === null ? 'Current start: custom' : `Current start: Shatrunz960 #${id}`;
            if (id960 && id !== null) id960.value = String(id);
        };
        showLabel();
        const apply = (fen) => {
            const err = validateStartFen(fen);
            fenErr.textContent = err ? `Not a valid start: ${err}` : '';
            if (err) return;
            setStartFen(fen);
            fenEl.value = fen.trim();
            showLabel();
            setOpen(false);
            document.getElementById('reset-game')?.click();
        };
        document.getElementById('drawer-start-apply')?.addEventListener('click', () => apply(fenEl.value));
        document.getElementById('drawer-start-standard')?.addEventListener('click', () => apply(STANDARD_START));
        document.getElementById('drawer-960-random')?.addEventListener('click', () => apply(startFenFor(randomShatrunz960Id())));
        document.getElementById('drawer-960-apply')?.addEventListener('click', () => {
            const id = Number(id960?.value);
            if (!Number.isInteger(id) || id < 0 || id > 8399) { fenErr.textContent = 'Shatrunz960 number must be 0–8399'; return; }
            apply(startFenFor(id));
        });
        document.getElementById('drawer-start-copy')?.addEventListener('click', () => {
            const g = window.__shatrunzGame?.();
            if (g) { fenEl.value = boardToStartFen(g.board, g.turn); fenErr.textContent = ''; }
        });
    }
    applyBodyToggles();
}
