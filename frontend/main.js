import { initWasm } from './shared/wasm_boot.js';
import { MODES } from './mode_logic.js';

const ROUTE_TO_MODE = {
    '/pvp': MODES.HVH,
    '/pvai': MODES.HVC,
    '/aivai': MODES.CVC,
};

function modeFromPath() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    return ROUTE_TO_MODE[path] || null;
}

function modeFromQuery() {
    const requested = new URLSearchParams(window.location.search).get('mode');
    return Object.values(MODES).includes(requested) ? requested : null;
}

async function boot() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    const params = new URLSearchParams(window.location.search);
    const androidApp = params.get('platform') === 'android' || Boolean(window.AndroidApp);
    if (androidApp) {
        document.body.classList.add('android-mvp');
        const boardArea = document.querySelector('.board-area');
        const moveNavigation = document.getElementById('live-nav-controls');
        if (boardArea && moveNavigation) boardArea.appendChild(moveNavigation);
        const turnStatusSlot = document.querySelector('.android-turn-status-slot');
        const turnStatus = document.getElementById('status');
        if (turnStatusSlot && turnStatus) turnStatusSlot.appendChild(turnStatus);
        // The local JavaScript strategies work offline; C Engine requires a service.
        document.querySelectorAll('#white-ai-strategy option[value="c_native"], #black-ai-strategy option[value="c_native"]')
            .forEach((option) => option.remove());
    }
    if (path === '/admin') {
        const { initAdmin } = await import('./admin_main.js');
        initAdmin();
        return;
    }

    const mode = modeFromQuery() || modeFromPath();
    if (!mode) return;

    await initWasm();
    document.body.classList.add(`mode-${mode}`);
    // ui.js creates GameSession at module scope, so it must not be evaluated
    // until the shared Rust/WASM rules engine is ready.
    const { initUI } = await import('./ui.js');
    initUI(mode);
}

boot().catch((err) => {
    console.error('Failed to boot ShatrunZ wasm:', err);
    document.body.innerHTML = `<pre style="padding:2rem;color:#c00">Failed to load engine wasm.\n${err}</pre>`;
});
