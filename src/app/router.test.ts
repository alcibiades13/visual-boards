import { describe, expect, it } from 'vitest';
import { hrefFor, parseHash } from './router';

describe('router', () => {
  it('parses routes', () => {
    expect(parseHash('')).toEqual({ name: 'dashboard' });
    expect(parseHash('#/')).toEqual({ name: 'dashboard' });
    expect(parseHash('#/b/abc_1')).toEqual({ name: 'board', boardId: 'abc_1' });
    expect(parseHash('#/nope')).toEqual({ name: 'dashboard' });
    expect(parseHash('#/library')).toEqual({ name: 'library' });
    expect(parseHash(hrefFor({ name: 'library' }))).toEqual({ name: 'library' });
  });

  it('round-trips board links', () => {
    expect(parseHash(hrefFor({ name: 'board', boardId: 'x-Y_9' }))).toEqual({ name: 'board', boardId: 'x-Y_9' });
  });
});
