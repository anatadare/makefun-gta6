// save.js — saving Solmara to localStorage: money, health, missions done,
// position, clock, weapon, ammo and run stats. Autosaves after every
// mission; the pause menu saves on demand; the title screen offers
// Continue when a save exists.

import { SAVE_KEY } from './config.js';

export function hasSave() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      money: state.money,
      health: state.health,
      ammo: state.ammo,
      weapon: state.weapon,
      clock: state.clock,
      missionsDone: state.missionsDone,
      player: { x: state.player.x, y: state.player.y },
      stats: state.stats,
      taxiTotal: state.taxi.total,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // No storage, nothing to clear.
  }
}

export function applySave(state, data) {
  state.money = data.money;
  state.health = data.health;
  state.ammo = data.ammo || 0;
  state.weapon = data.weapon || 'fists';
  state.clock = data.clock;
  state.missionsDone = data.missionsDone || [];
  state.stats = { ...state.stats, ...(data.stats || {}) };
  state.taxi.total = data.taxiTotal || 0;
  if (data.player) {
    state.player.x = data.player.x;
    state.player.y = data.player.y;
  }
}

export function autosave(state) {
  if (saveGame(state)) {
    state.message = { text: 'Progress saved', timer: 2 };
  }
}
