import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WalkerControl } from '../src/control.ts';
function simulate(c: WalkerControl, seconds: number, target: number | null, start = 1000) {
  for (let i = 0; i < seconds * 60; i++) {
    const time = start + i * 1000 / 60;
    if (target !== null) c.setTarget(target, time);
    const before = c.velocity;
    c.update(1 / 60, time);
    assert.ok(Math.abs(c.velocity - before) <= 480 / 60 + 0.001);
    assert.ok(c.x >= c.left && c.x <= c.right);
    assert.ok(Math.abs(c.velocity) <= 175);
  }
}
test('caminha nas duas direções e desacelera perto do alvo', () => {
  const c = new WalkerControl();
  simulate(c, 5, 1); assert.ok(c.x > 895); assert.ok(Math.abs(c.velocity) < 1); assert.equal(c.direction, 1);
  simulate(c, 7, 0, 7000); assert.ok(c.x < 105); assert.ok(Math.abs(c.velocity) < 1); assert.equal(c.direction, -1);
});
test('tolera perda breve, para em ausência prolongada e recupera sem salto', () => {
  const c = new WalkerControl(); simulate(c, 1, 1);
  const now = c.lastSeen;
  const velocity = c.velocity;
  c.update(0.05, now + 200); assert.equal(c.velocity, velocity);
  c.update(0.05, now + 300); assert.ok(c.velocity < velocity);
  simulate(c, 2, null, now + 350); assert.equal(c.velocity, 0);
  const x = c.x; c.setTarget(0, now + 3000); c.update(1 / 60, now + 3000);
  assert.ok(Math.abs(c.x - x) < 3);
});
test('zona morta rejeita tremor e dt é limitado após pausa', () => {
  const c = new WalkerControl();
  for (let i = 0; i < 60; i++) { c.setTarget(0.5 + Math.sin(i) * 0.002, i * 17 + 1000); c.update(1 / 60, i * 17 + 1000); }
  assert.equal(c.x, 500);
  c.setTarget(1, 4000); c.update(30, 4000); assert.ok(c.x - 500 <= 1.21);
});
test('mouse/toque define o destino final mesmo quando os eventos cessam', () => {
  const c = new WalkerControl();
  c.setTarget(0.6, 1000, false); c.setTarget(0.9, 1016, false);
  assert.equal(c.target, c.left + 0.9 * (c.right - c.left));
  const before = c.x; c.update(1 / 60, 1032, true);
  assert.ok(c.x - before < 1);
});
