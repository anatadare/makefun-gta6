// Progress in localStorage (this browser only): cash, the story's place,
// lifetime earnings, found stashes and cars stolen. Saves carry a version
// number; an older save, or anything unreadable, loads as far as it can and
// fills the rest with fresh defaults, so a bad save never bricks the game.

import { SAVE_KEY } from './config.js';

const SAVE_VERSION = 2;

function freshSave() {
  return { v: SAVE_VERSION, money: 0, missionIndex: 0, totalEarned: 0, stashes: [], carsStolen: 0 };
}

function asNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function asIndexList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((n) => Number.isInteger(n) && n >= 0);
}

export function loadSave() {
  let data = null;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (raw) data = JSON.parse(raw);
  } catch {
    data = null;
  }
  if (!data || typeof data !== 'object') return freshSave();
  return {
    v: SAVE_VERSION,
    money: asNumber(data.money, 0),
    missionIndex: Number.isInteger(data.missionIndex) ? Math.max(0, data.missionIndex) : 0,
    totalEarned: asNumber(data.totalEarned, 0),
    stashes: asIndexList(data.stashes),
    carsStolen: Number.isInteger(data.carsStolen) ? Math.max(0, data.carsStolen) : 0,
  };
}

export function saveGame(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, v: SAVE_VERSION }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}
