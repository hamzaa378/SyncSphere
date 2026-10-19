import test from 'node:test';
import assert from 'node:assert/strict';
import { compareStamp, validValue, parseRegister, blankRegisters, KEYS } from '../dist/core/register.js';

test('larger counter always wins', () => {
  assert.equal(compareStamp({ counter: 9, actor: 'a' }, { counter: 8, actor: 'z' }), 1);
  assert.equal(compareStamp({ counter: 1, actor: 'z' }, { counter: 4, actor: 'a' }), -1);
});
test('simultaneous edits use deterministic tab ID tie break', () => {
  const a = { counter: 4, actor: 'aaaa' };
  const b = { counter: 4, actor: 'zzzz' };
  assert.equal(compareStamp(a, b), -1);
  assert.equal(compareStamp(b, a), 1);
  assert.equal(compareStamp(b, b), 0);
});
test('ordering is antisymmetric and independent of receipt order', () => {
  for (const n of [0, 1, 15, 300]) {
    for (const m of [0, 2, 15, 400]) {
      const a = { counter: n, actor: 'tab1' }, b = { counter: m, actor: 'tab2' };
      assert.equal(Math.sign(compareStamp(a, b)), -Math.sign(compareStamp(b, a)));
      assert.equal([a, b].reduce((x, y) => compareStamp(x, y) >= 0 ? x : y).actor,
        [b, a].reduce((x, y) => compareStamp(x, y) >= 0 ? x : y).actor);
    }
  }
});
test('strict preference validation blocks unsupported values', () => {
  assert.equal(validValue('theme', 'light'), true);
  assert.equal(validValue('theme', 'blue'), false);
  assert.equal(validValue('language', 'hi'), true);
  assert.equal(validValue('language', 'xx'), false);
  assert.equal(validValue('fontSize', 14), true);
  assert.equal(validValue('fontSize', 22), true);
  assert.equal(validValue('fontSize', 13), false);
  assert.equal(validValue('fontSize', '18'), false);
});
test('reject malformed saved data and invalid stamps', () => {
  assert.equal(parseRegister('theme', { value: 'dark', stamp: { counter: 4, actor: 'x' } })?.value, 'dark');
  assert.equal(parseRegister('theme', { value: 'dark', stamp: { counter: -1, actor: 'x' } }), null);
  assert.equal(parseRegister('theme', { value: 'dark', stamp: { counter: Infinity, actor: 'x' } }), null);
  assert.equal(parseRegister('theme', { value: 'neon', stamp: { counter: 3, actor: 'x' } }), null);
  assert.equal(parseRegister('theme', null), null);
});
test('all default preferences are independent zero-clock registers', () => {
  const records = blankRegisters();
  assert.deepEqual(KEYS, ['theme', 'language', 'fontSize']);
  assert.equal(records.theme.value, 'light');
  assert.equal(records.language.value, 'en');
  assert.equal(records.fontSize.value, 16);
  records.theme.stamp.counter = 23;
  assert.equal(records.fontSize.stamp.counter, 0);
});
