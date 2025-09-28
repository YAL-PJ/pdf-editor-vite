import { beforeEach, describe, expect, it } from 'vitest';

import {
  getHistoryEntries,
  getHistoryTimeline,
  historyBegin,
  historyCommit,
  historyInit,
  jumpToHistory,
  redo,
  undo,
} from '../../src/app/history.js';
import { state } from '../../src/app/state.js';

describe('history entries', () => {
  beforeEach(() => {
    state.annotations = {};
    state.pageNum = 1;
    state.scale = 1;
    historyInit();
  });

  it('preserves explicit labels for committed edits', () => {
    historyBegin('Moved highlight');
    historyCommit();

    const entries = getHistoryEntries();
    const present = entries.find((entry) => entry.type === 'present');

    expect(present).toBeTruthy();
    if (!present) return;

    expect(present.label).toBe('Moved highlight');
    expect(present.id).toBeGreaterThan(1);
  });

  it('falls back to numbered labels when none are supplied', () => {
    historyBegin();
    historyCommit();

    const entries = getHistoryEntries();
    const present = entries.find((entry) => entry.type === 'present');

    expect(present).toBeTruthy();
    if (!present) return;

    expect(present.label).toBe(`Edit ${present.id}`);
  });

  it('keeps timeline slices in sync with canonical entries', () => {
    historyBegin('First change');
    historyCommit();
    historyBegin('Second change');
    historyCommit();

    const timeline = getHistoryTimeline();
    const entries = getHistoryEntries();

    expect(timeline.present?.label).toBe('Second change');
    expect(timeline.past.map((entry) => entry.id)).toEqual([1, 2]);

    const orderedIds = entries.map((entry) => entry.id);
    expect(orderedIds).toEqual([2, 1, 3]);
    expect(entries.map((entry) => entry.label)).toEqual([
      'First change',
      'Initial state',
      'Second change',
    ]);
  });

  it('branches correctly when committing after undo', () => {
    historyBegin('Initial edit');
    historyCommit();
    historyBegin('Second edit');
    historyCommit();

    expect(undo()).toBe(true);
    expect(undo()).toBe(true);

    historyBegin('New branch');
    historyCommit();

    const timeline = getHistoryTimeline();
    expect(timeline.future).toHaveLength(0);
    expect(timeline.present?.label).toBe('New branch');
    expect(timeline.past.map((entry) => entry.label)).toEqual([
      'Initial state',
    ]);
  });

  it('supports jumping to any historical id', () => {
    historyBegin('Alpha');
    historyCommit();
    historyBegin('Bravo');
    historyCommit();
    historyBegin('Charlie');
    historyCommit();

    const entries = getHistoryEntries();
    const targetId = entries.find((entry) => entry.label === 'Bravo')?.id;
    expect(targetId).toBeDefined();
    if (!targetId) return;

    expect(jumpToHistory(targetId)).toBe(true);
    const afterJump = getHistoryTimeline();
    expect(afterJump.present?.label).toBe('Bravo');
    expect(redo()).toBe(true);
    const afterRedo = getHistoryTimeline();
    expect(afterRedo.present?.label).toBe('Charlie');
  });
});
