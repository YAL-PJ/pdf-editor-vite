import { describe, it, expect } from 'vitest';
import { makeSaveName, extractOriginalName } from '../../src/app/filename.js';

describe('makeSaveName', () => {
  it('adds marker with default ext when no name', () => {
    expect(makeSaveName(null)).toBe('annotated.pdf');
  });
  it('adds marker before extension', () => {
    expect(makeSaveName('report.pdf')).toBe('report (annotated).pdf');
  });
  it('does not duplicate marker', () => {
    expect(makeSaveName('report (annotated).pdf')).toBe('report (annotated).pdf');
  });
  it('handles filenames without extension', () => {
    expect(makeSaveName('report')).toBe('report (annotated).pdf');
  });
});

describe('extractOriginalName', () => {
  it('reads from input event.files[0].name', () => {
    const picked = { target: { files: [{ name: 'from-input.pdf' }] } };
    expect(extractOriginalName(picked)).toBe('from-input.pdf');
  });
  it('reads from direct object with name', () => {
    expect(extractOriginalName({ name: 'direct.pdf' })).toBe('direct.pdf');
  });
  it('reads from wrapper { file: { name } }', () => {
    expect(extractOriginalName({ file: { name: 'wrapped.pdf' } })).toBe('wrapped.pdf');
  });
  it('returns null when nothing found', () => {
    expect(extractOriginalName({})).toBe(null);
  });
});
