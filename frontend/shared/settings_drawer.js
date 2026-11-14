/**
 * Slide-out settings drawer: one place for the knobs that were scattered
 * across the page (or only reachable from /admin). It never owns state the
 * page already has: strength, theme and board rotation are *proxied* to the
 * existing controls (so their handlers, hints and persistence still run);
 * new toggles are plain localStorage keys read where they apply.
 */
import { SettingsKeys, getSettings, setNum } from './settings_store.js';
import { STANDARD_START, boardToStartFen, getStartFen, setStartFen, validateStartFen } from './start_position.js';

export const DrawerKeys = {
    animations: 'shatrunz_animations',
    engineLine: 'shatrunz_show_engine_line',
    captured: 'shatrunz_show_captured',
};

/** Toggles default to on; only an explicit '0' turns one off. */
export function drawerToggle(key) {
    try { return localStorage.getItem(key) !== '0'; } catch { return true; }
}

const THINK_TIMES = [[0, 'Auto (by strength)'], [250, '0.25 s'], [500, '0.5 s'], [1000, '1 s'], [2000, '2 s'], [5000, '5 s']];

function applyBodyToggles() {
    document.body.classList.toggle('hide-engine-line', !drawerToggle(DrawerKeys.engineLine));
    document.body.classList.toggle('hide-captured', !drawerToggle(DrawerKeys.captured));
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

    const sync = () => {
        const pageLevel = document.getElementById('ai-level')?.value || getSettings().aiLevel || 3;
        level.value = String(pageLevel);
        levelOut.textContent = String(pageLevel);
        think.value = String(THINK_TIMES.some(([v]) => v === getSettings().thinkTimeMs) ? getSettings().thinkTimeMs : 0);
        theme.value = document.getElementById('board-theme')?.value || 'classic';
        for (const [key, id] of [[DrawerKeys.animations, 'drawer-animations'], [DrawerKeys.engineLine, 'drawer-engine-line'], [DrawerKeys.captured, 'drawer-captured']]) {
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
    for (const [key, id] of [[DrawerKeys.animations, 'drawer-animations'], [DrawerKeys.engineLine, 'drawer-engine-line'], [DrawerKeys.captured, 'drawer-captured']]) {
        document.getElementById(id).addEventListener('change', (e) => {
            localStorage.setItem(key, e.target.checked ? '1' : '0');
            applyBodyToggles();
        });
    }
    // Start position (#30): validated by the Rust rules before it's saved.
    const fenEl = document.getElementById('drawer-start-fen');
    const fenErr = document.getElementById('drawer-start-error');
    if (fenEl) {
        fenEl.value = getStartFen() || STANDARD_START;
        const apply = (fen) => {
            const err = validateStartFen(fen);
            fenErr.textContent = err ? `Not a valid start: ${err}` : '';
            if (err) return;
            setStartFen(fen);
            fenEl.value = fen.trim();
            setOpen(false);
            document.getElementById('reset-game')?.click();
        };
        document.getElementById('drawer-start-apply')?.addEventListener('click', () => apply(fenEl.value));
        document.getElementById('drawer-start-standard')?.addEventListener('click', () => apply(STANDARD_START));
        document.getElementById('drawer-start-copy')?.addEventListener('click', () => {
            const g = window.__shatrunzGame?.();
            if (g) { fenEl.value = boardToStartFen(g.board, g.turn); fenErr.textContent = ''; }
        });
    }
    applyBodyToggles();
}
