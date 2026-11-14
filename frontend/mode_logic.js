import { COLORS } from './constants.js';

export const MODES = { HVH: 'hvh', HVC: 'hvc', CVC: 'cvc' };

export function getAiColor(computerSideValue) {
    return computerSideValue === 'white' ? COLORS.WHITE : COLORS.BLACK;
}

export function isAiTurn({ turn, computerSideValue }) {
    const aiColor = getAiColor(computerSideValue);
    return turn === aiColor;
}

export function shouldBlockHumanInput({ mode, gameOver, autoRunning, isTraining, turn, computerSideValue }) {
    if (gameOver || isTraining) return true;
    if (mode === MODES.CVC) return true;
    if (mode === MODES.HVC) return isAiTurn({ turn, computerSideValue });
    // HvH blocks only when game over or training; autoRunning is irrelevant.
    return false;
}

/**
 * AI vs AI fixes both players' strength when the game starts (so a game is
 * one fair match-up). A strength change mid-game is therefore deferred to
 * the next game unless the admin "allow mid-game change" setting is on.
 */
export function shouldDeferLevelChange({ mode, allowMidgame, gameInProgress }) {
    return mode === MODES.CVC && gameInProgress && !allowMidgame;
}

export function shouldTriggerAiMove({ mode, gameOver, autoRunning, turn, computerSideValue }) {
    if (gameOver || !autoRunning) return false;
    if (mode === MODES.CVC) return true;
    if (mode === MODES.HVC) return isAiTurn({ turn, computerSideValue });
    return false;
}

