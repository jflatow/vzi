import * as vzi from '../../lib/vzi.ts';

import { assert, assertEquals, assertRejects } from 'https://deno.land/std/testing/asserts.ts';

Deno.test('tryNum', async () => {
  const a = vzi.tryNum('2023-01-01');
  assertEquals(a, new Date(Date.UTC(2023, 0, 1)));

  const b = vzi.tryNum('2023');
  assertEquals(b, 2023);

  const c = vzi.tryNum('2023-');
  assertEquals(c, new Date(2023, 0, 1)); // NB: weird!

  const d = vzi.tryNum('2023x');
  assertEquals(d, '2023x');

  const e = vzi.tryNum('1.1e-6');
  assertEquals(e, 1.1e-6);
});

Deno.test('indexOrEvalFun', async () => {
  const event = ['1', '2', '.0003'];

  const kp = 'Math.round($[2] * 1e5) / 1e5';
  const key = vzi.indexOrEvalFun(kp, () => 1, true);
  const k = key(event);
  assertEquals(k, .0003);

  const vp = '1';
  const val = vzi.indexOrEvalFun(vp);
  const v = val(event);
  assertEquals(v, 2);
});

Deno.test('maybeEvalFun', async () => {
  const scale = 'Math.exp(_)';
  const val = vzi.maybeEvalFun(scale);
  const v = val(2);
  assertEquals(v, Math.exp(2));
});