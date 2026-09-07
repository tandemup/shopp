import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const importSource = async (file) => import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(file, import.meta.url), 'utf8')).toString('base64')}`);
const { createExclusivePlayback } = await importSource('../src/services/exclusivePlayback.js');
const { buildNativeYouTubeHtml } = await importSource('../src/components/playback/nativeYouTubeHtml.js');
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test('waits for the previous player to confirm silence before granting playback', async () => {
  const gate = createExclusivePlayback();
  const paused = deferred();
  gate.register('music', () => paused.promise);
  let granted = false;
  gate.register('preview', () => {});
  const request = gate.claim('preview').then((allowed) => { granted = allowed; });
  await Promise.resolve();
  assert.equal(granted, false);
  paused.resolve();
  await request;
  assert.equal(granted, true);
});

test('rapid changes grant only the latest request, even during an asynchronous pause', async () => {
  const gate = createExclusivePlayback();
  const pause = deferred();
  gate.register('a', () => pause.promise);
  gate.register('b', () => {});
  gate.register('c', () => {});
  const b = gate.claim('b');
  await Promise.resolve();
  const c = gate.claim('c');
  pause.resolve();
  assert.equal(await b, false);
  assert.equal(await c, true);
  assert.equal(gate.owns('b'), false);
});

test('a failed pause prevents playback; the queue can recover', async () => {
  const gate = createExclusivePlayback();
  const remove = gate.register('a', () => { throw new Error('unresponsive player'); });
  gate.register('b', () => {});
  await assert.rejects(gate.claim('b'), /unresponsive/);
  remove();
  assert.equal(await gate.claim('b'), true);
});

test('unmounted players cannot receive a delayed grant', async () => {
  const gate = createExclusivePlayback();
  const pause = deferred();
  gate.register('a', () => pause.promise);
  const remove = gate.register('b', () => {});
  const request = gate.claim('b');
  await Promise.resolve();
  remove(); pause.resolve();
  assert.equal(await request, false);
});

function nativeHarness() {
  const messages = [];
  let events, state = -1, muted = false;
  const player = {
    mute: () => { muted = true; }, unMute: () => { muted = false; }, isMuted: () => muted,
    playVideo: () => { state = 1; events.onStateChange({ data: 1 }); },
    pauseVideo: () => { state = 2; events.onStateChange({ data: 2 }); },
    playVideoAt: () => { state = 1; events.onStateChange({ data: 1 }); },
    getPlayerState: () => state, getVideoData: () => ({ video_id: 'RyEAyVGFvIo' }),
    getCurrentTime: () => 10, getDuration: () => 100, getPlaylist: () => [], getPlaylistIndex: () => 0,
    seekTo: () => {},
  };
  const html = buildNativeYouTubeHtml({ kind: 'single', videoId: 'RyEAyVGFvIo' }, 'test');
  const context = vm.createContext({
    window: { ReactNativeWebView: { postMessage: (value) => messages.push(JSON.parse(value)) } },
    document: { createElement: () => ({}), head: { appendChild() {} } },
    setInterval() {}, setTimeout() {},
    YT: { Player: function (node, options) { events = options.events; return player; } },
  });
  vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1], context);
  context.onYouTubeIframeAPIReady(); events.onReady();
  return { messages, player, context, command: context.window.shoppCommand };
}

test('native player starts muted and waits for permission before producing audio', () => {
  const h = nativeHarness();
  const claim = h.messages.find((m) => m.type === 'claim');
  assert.equal(claim.initial, true);
  assert.equal(h.player.isMuted(), true);
  assert.equal(h.player.getPlayerState(), -1);
  h.command('grant', { ticket: claim.ticket });
  assert.equal(h.player.getPlayerState(), 1);
  assert.equal(h.player.isMuted(), false);
  h.command('suspend', null, 42);
  assert.equal(h.player.isMuted(), true);
  assert.equal(h.player.getPlayerState(), 2);
  assert.ok(h.messages.some((m) => m.type === 'ack' && m.requestId === 42 && !m.error));
});

test('native controls cannot revive an old grant after a pause or takeover', () => {
  const h = nativeHarness();
  const first = h.messages.find((m) => m.type === 'claim');
  h.command('suspend', null, 1);
  h.command('grant', { ticket: first.ticket });
  assert.equal(h.player.isMuted(), true);
  assert.equal(h.player.getPlayerState(), 2);
  h.player.playVideo(); // user presses Play inside the paused YouTube iframe
  assert.equal(h.player.isMuted(), true);
  const latest = h.messages.filter((m) => m.type === 'claim').at(-1);
  assert.ok(latest.ticket > first.ticket);
  h.command('grant', { ticket: latest.ticket });
  assert.equal(h.player.isMuted(), false);
});
