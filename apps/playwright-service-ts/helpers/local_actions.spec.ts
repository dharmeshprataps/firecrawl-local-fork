import assert from 'node:assert/strict';
import test from 'node:test';
import type { Page } from 'playwright';
import { runLocalActions, validateLocalActions } from './local_actions';

test('rejects arbitrary JavaScript and unbounded browser work before execution', () => {
  assert.throws(() => validateLocalActions([{ type: 'executeJavascript', script: 'fetch("http://127.0.0.1")' }]), /Unsupported local action/);
  assert.throws(() => validateLocalActions(Array.from({ length: 13 }, () => ({ type: 'scrape' }))), /at most 12 actions/);
  assert.throws(() => validateLocalActions([{ type: 'wait', milliseconds: 5001 }]), /between 1 and 5000ms/);
  assert.throws(() => validateLocalActions([{ type: 'wait', selector: '#ready', milliseconds: 1 }]), /exactly one/);
  assert.throws(() => validateLocalActions([], { viewport: { width: 1921, height: 1080 } }), /exceeds 1920x1080/);
});

test('keeps action results in order and bounds screenshot dimensions and output', async () => {
  const calls: unknown[] = [];
  const page = {
    url: () => 'https://example.com/next',
    content: async () => '<main>Ready after click</main>',
    waitForSelector: async (selector: string) => { calls.push(['wait', selector]); },
    locator: (selector: string) => ({ nth: () => ({ click: async () => { calls.push(['click', selector]); } }) }),
    viewportSize: () => ({ width: 1280, height: 720 }),
    evaluate: async () => 50000,
    screenshot: async (options: unknown) => { calls.push(['screenshot', options]); return Buffer.from('image'); },
  } as unknown as Page;
  const result = await runLocalActions(page, [
    { type: 'wait', selector: '#ready' },
    { type: 'click', selector: '#next' },
    { type: 'scrape' },
  ], { fullPage: true });
  assert.deepEqual(result.actions.scrapes, [{ url: 'https://example.com/next', html: '<main>Ready after click</main>' }]);
  assert.deepEqual(calls, [
    ['wait', '#ready'],
    ['click', '#next'],
    ['screenshot', { type: 'jpeg', quality: 65, clip: { x: 0, y: 0, width: 1280, height: 12000 }, timeout: 10000 }],
  ]);
  assert.equal(result.screenshot, 'data:image/jpeg;base64,' + Buffer.from('image').toString('base64'));
  page.screenshot = async () => Buffer.alloc(1500001);
  await assert.rejects(runLocalActions(page, [], {}), /exceeds 1.5MB/);
});

test('shared deadline interrupts a pending wait and prevents later actions', async () => {
  let scrapes = 0;
  let releaseWait!: () => void;
  const page = {
    waitForTimeout: () => new Promise<void>((resolve) => { releaseWait = resolve; }),
    content: async () => { scrapes++; return 'must not run'; },
  } as unknown as Page;
  const started = Date.now();
  await assert.rejects(runLocalActions(page, [
    { type: 'wait', milliseconds: 5000 },
    { type: 'scrape' },
  ], undefined, { deadline: Date.now() + 30 }), /request timed out/);
  assert.equal(scrapes, 0);
  assert.ok(Date.now() - started < 1000, 'the full five-second wait must not consume the page permit');
  releaseWait();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(scrapes, 0, 'late browser completion must not start another action');
});

test('client cancellation interrupts a pending selector without executing later actions', async () => {
  const controller = new AbortController();
  let scrapes = 0;
  let releaseWait!: () => void;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const page = {
    waitForSelector: () => { markStarted(); return new Promise<void>((resolve) => { releaseWait = resolve; }); },
    content: async () => { scrapes++; return 'must not run'; },
  } as unknown as Page;
  const result = runLocalActions(page, [
    { type: 'wait', selector: '#never-ready' },
    { type: 'scrape' },
  ], undefined, { deadline: Date.now() + 5000, signal: controller.signal });
  await started;
  controller.abort(new Error('client disconnected'));
  await assert.rejects(result, /client disconnected/);
  assert.equal(scrapes, 0);
  releaseWait();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(scrapes, 0, 'late browser completion must not start another action');
});
