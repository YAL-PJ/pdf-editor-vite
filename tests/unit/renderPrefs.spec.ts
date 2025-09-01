import { describe, it, expect, beforeEach } from 'vitest';
import {
  initFromStorage, getPrefs, setPrefs,
  toggleGuides, cycleEdge, getGuidesEnabled, getEdgePx
} from '../../src/app/renderPrefs.js';

// simple mock localStorage
class MemStore {
  store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}
const mem = new MemStore();

beforeEach(() => {
  // @ts-ignore
  globalThis.localStorage = mem;
  mem.clear();
});

describe('renderPrefs', () => {
  it('initializes with defaults when storage empty', () => {
    const p = initFromStorage();
    expect(p.snapToGuides).toBe(true);
    expect(p.snapEdgePx).toBe(8);
  });

  it('toggles guides and persists', () => {
    initFromStorage();
    expect(getGuidesEnabled()).toBe(true);
    toggleGuides();
    expect(getGuidesEnabled()).toBe(false);
    const p = getPrefs();
    expect(p.snapToGuides).toBe(false);
  });

  it('cycles edge 8→12→16→4', () => {
    initFromStorage();
    expect(getEdgePx()).toBe(8);
    cycleEdge(); expect(getEdgePx()).toBe(12);
    cycleEdge(); expect(getEdgePx()).toBe(16);
    cycleEdge(); expect(getEdgePx()).toBe(4);
  });

  it('setPrefs merges and persists', () => {
    initFromStorage();
    setPrefs({ snapToGuides: false, snapEdgePx: 12 });
    const p = getPrefs();
    expect(p.snapToGuides).toBe(false);
    expect(p.snapEdgePx).toBe(12);
  });
});
