import { describe, expect, it } from 'vitest';
import { parseQuotes, quoteKey, stripOuterQuotes } from './quoteParser';

describe('parseQuotes — separators', () => {
  it('splits on blank lines by default', () => {
    const input = 'The journey is the thing.\n\nNot all those who wander are lost.\n\n\nStay close to anything that makes you glad you are alive.';
    expect(parseQuotes(input).map((q) => q.text)).toEqual([
      'The journey is the thing.',
      'Not all those who wander are lost.',
      'Stay close to anything that makes you glad you are alive.',
    ]);
  });

  it('keeps multi-line quotes together in blank-line mode', () => {
    expect(parseQuotes('Line one\nline two\n\nOther')).toEqual([{ text: 'Line one\nline two' }, { text: 'Other' }]);
  });

  it('treats every line as a quote in each-line mode', () => {
    const input = 'First one\nSecond one\n\nThird one\n';
    expect(parseQuotes(input, { eachLine: true }).map((q) => q.text)).toEqual(['First one', 'Second one', 'Third one']);
  });

  it('handles CRLF and surrounding whitespace', () => {
    expect(parseQuotes('  A quote  \r\n\r\n  Another  ')).toEqual([{ text: 'A quote' }, { text: 'Another' }]);
  });

  it('ignores empty input', () => {
    expect(parseQuotes('')).toEqual([]);
    expect(parseQuotes('\n\n  \n')).toEqual([]);
  });
});

describe('parseQuotes — authors', () => {
  it.each([
    ['The journey is the thing. | Homer', 'The journey is the thing.', 'Homer'],
    ['The journey is the thing. — Homer', 'The journey is the thing.', 'Homer'],
    ['The journey is the thing. – Homer', 'The journey is the thing.', 'Homer'],
    ['The journey is the thing. - Homer', 'The journey is the thing.', 'Homer'],
    ['"The journey is the thing."—Homer', 'The journey is the thing.', 'Homer'],
    ['“Not all those who wander are lost.” — J. R. R. Tolkien', 'Not all those who wander are lost.', 'J. R. R. Tolkien'],
    ['„Ko rano rani, dve sreće grabi.“ – Narodna izreka', 'Ko rano rani, dve sreće grabi.', 'Narodna izreka'],
    ['«Carpe diem» | Horace, Odes', 'Carpe diem', 'Horace, Odes'],
  ])('inline: %s', (input, text, author) => {
    expect(parseQuotes(input)).toEqual([{ text, author }]);
    expect(parseQuotes(input, { eachLine: true })).toEqual([{ text, author }]);
  });

  it('reads the author from a separate last line starting with a dash', () => {
    const input = 'Stay close to anything\nthat makes you glad you are alive.\n— Hafiz\n\nSecond quote\n- Someone Else';
    expect(parseQuotes(input)).toEqual([
      { text: 'Stay close to anything\nthat makes you glad you are alive.', author: 'Hafiz' },
      { text: 'Second quote', author: 'Someone Else' },
    ]);
  });

  it('attaches a dash line to the previous quote in each-line mode', () => {
    expect(parseQuotes('The journey is the thing.\n— Homer\nAnother quote', { eachLine: true })).toEqual([
      { text: 'The journey is the thing.', author: 'Homer' },
      { text: 'Another quote' },
    ]);
  });

  it('attaches a dash line separated by a blank line', () => {
    expect(parseQuotes('The journey is the thing.\n\n— Homer')).toEqual([{ text: 'The journey is the thing.', author: 'Homer' }]);
  });

  it('does not mistake dashes inside a sentence for an author', () => {
    expect(parseQuotes('The journey — not the destination — matters most')).toEqual([
      { text: 'The journey — not the destination — matters most' },
    ]);
    expect(parseQuotes('Well-being is a practice.')).toEqual([{ text: 'Well-being is a practice.' }]);
    expect(parseQuotes('Do it now - there will never be a better time.')).toEqual([
      { text: 'Do it now - there will never be a better time.' },
    ]);
  });

  it('strips list bullets', () => {
    expect(parseQuotes('- Not all those who wander are lost.\n1. Carpe diem.\n• Less is more.', { eachLine: true })).toEqual([
      { text: 'Not all those who wander are lost.' },
      { text: 'Carpe diem.' },
      { text: 'Less is more.' },
    ]);
  });
});

describe('stripOuterQuotes', () => {
  it.each([
    ['"x"', 'x'],
    ['“x”', 'x'],
    ['„x“', 'x'],
    ['„x”', 'x'],
    ['«x»', 'x'],
    ['x', 'x'],
    ['"x', '"x'],
  ])('%s -> %s', (input, output) => {
    expect(stripOuterQuotes(input)).toBe(output);
  });
});

describe('quoteKey', () => {
  it('ignores case, punctuation and spacing', () => {
    expect(quoteKey('Carpe  diem!')).toBe(quoteKey('carpe diem'));
    expect(quoteKey('Carpe diem')).not.toBe(quoteKey('Carpe noctem'));
  });
});
