import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock history/persistence used inside handlerWrapper
const historyBegin = vi.fn();
const historyCommit = vi.fn();
const scheduleSave = vi.fn();

vi.mock('@app/history', () => ({
  historyBegin: (...args: any[]) => historyBegin(...args),
  historyCommit: (...args: any[]) => historyCommit(...args),
}));

vi.mock('@app/persistence', () => ({
  scheduleSave: (...args: any[]) => scheduleSave(...args),
}));

// Import after mocks so the module picks up mocked deps
import { wrapHandler } from '../../src/app/handlerWrapper.js';

beforeEach(() => {
  historyBegin.mockClear();
  historyCommit.mockClear();
  scheduleSave.mockClear();
});

describe('wrapHandler', () => {
  it('commits & saves on synchronous success', () => {
    const fn = vi.fn().mockReturnValue(123);
    const wrapped = wrapHandler('onSomething', fn);

    const result = wrapped('a', 'b');
    expect(result).toBe(123);

    expect(fn).toHaveBeenCalledWith('a', 'b');
    expect(historyBegin).toHaveBeenCalledTimes(1);
    expect(historyCommit).toHaveBeenCalledTimes(1);
    expect(scheduleSave).toHaveBeenCalledTimes(1);
  });

  it('does NOT commit/save on synchronous failure', () => {
    const err = new Error('boom');
    const fn = vi.fn().mockImplementation(() => {
      throw err;
    });
    const wrapped = wrapHandler('onSomething', fn);

    expect(() => wrapped()).toThrow(err);
    expect(historyBegin).toHaveBeenCalledTimes(1);
    expect(historyCommit).not.toHaveBeenCalled();
    expect(scheduleSave).not.toHaveBeenCalled();
  });

  it('commits & saves on async success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const wrapped = wrapHandler('onSomething', fn);

    await expect(wrapped(1)).resolves.toBe('ok');

    expect(fn).toHaveBeenCalledWith(1);
    expect(historyBegin).toHaveBeenCalledTimes(1);
    expect(historyCommit).toHaveBeenCalledTimes(1);
    expect(scheduleSave).toHaveBeenCalledTimes(1);
  });

  it('does NOT commit/save on async failure', async () => {
    const err = new Error('nope');
    const fn = vi.fn().mockRejectedValue(err);
    const wrapped = wrapHandler('onSomething', fn);

    await expect(wrapped()).rejects.toThrow(err);

    expect(historyBegin).toHaveBeenCalledTimes(1);
    expect(historyCommit).not.toHaveBeenCalled();
    expect(scheduleSave).not.toHaveBeenCalled();
  });

  it('skips wrapping for non-mutating handlers', () => {
    const names = [
      'onUndo',
      'onRedo',
      'onHistoryJump',
      'onPrev',
      'onNext',
      'onZoomIn',
      'onZoomOut',
      'onZoomFit',
      'onZoomInput',
      'onPageInput',
      'onToolChange',
      'onPickImage',
      'onImageSelected',
    ];

    names.forEach((name) => {
      const fn = vi.fn().mockReturnValue('pass');
      const wrapped = wrapHandler(name, fn);

      expect(wrapped).toBe(fn);
      expect(wrapped('x')).toBe('pass');
      expect(fn).toHaveBeenCalledWith('x');

      expect(historyBegin).not.toHaveBeenCalled();
      expect(historyCommit).not.toHaveBeenCalled();
      expect(scheduleSave).not.toHaveBeenCalled();

      historyBegin.mockClear();
      historyCommit.mockClear();
      scheduleSave.mockClear();
    });
  });
});

