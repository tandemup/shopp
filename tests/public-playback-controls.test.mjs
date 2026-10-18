import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../src/screens/playlist/PublicMusicCardScreen.js', import.meta.url), 'utf8');
test('repeat one, next y play/pause por pista', () => {
  assert.match(source, /const \[repeatOne, setRepeatOne\] = useState\(false\)/);
  assert.match(source, /const \[advanceAutomatically, setAdvanceAutomatically\] = useState\(true\)/);
  assert.match(source, /if \(repeatRef\.current\) \{/);
  assert.match(source, /send\("seekTo", \[0, true\]\)/);
  assert.match(source, /else if \(advanceRef\.current/);
  assert.match(source, /accessibilityLabel="Repeat 1: repetir pista actual"/);
  assert.match(source, /accessibilityLabel="Autoplay next: continuar con la siguiente canción"/);
  assert.match(source, /currentPlaying \? "pauseVideo" : "playVideo"/);
  assert.match(source, /item\.lyricsUrl \?/);
});
