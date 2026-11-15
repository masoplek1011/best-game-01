// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play, paused,
// game over and victory. Every world event is answered here with a sound and a
// burst of particles, so each action has feedback you can hear and see.
//
// ?seed=N fixes the wave pattern. ?shot=title|play|gameover|victory (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createSeededRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEffects } from './particles.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createSeededRandom(seed));
const effects = createEffects();
const audio = createAudio();
const renderer = createRenderer(canvas, effects);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

/** Turn one world event into sound and particles. */
function reactToEvent(event) {
  if (event.type === 'shoot') {
    audio.shoot();
  } else if (event.type === 'hit') {
    audio.hitEnemy();
    effects.burst(event.x, event.y, '#ffe45e', 3, 140);
  } else if (event.type === 'enemyDied') {
    audio.explode();
    effects.burst(event.x, event.y, '#ff4fd8', 18, 280);
    effects.ring(event.x, event.y, '#ff4fd8');
    effects.floatText(event.x, event.y, `+${event.score}`, '#ffd166');
    effects.shake(2);
  } else if (event.type === 'playerHurt') {
    audio.hurt();
    effects.burst(event.x, event.y, '#ff4f6d', 16, 260);
    effects.shake(9);
  } else if (event.type === 'dash') {
    audio.dash();
    effects.burst(event.x, event.y, '#4dffd2', 8, 180);
  } else if (event.type === 'pickup') {
    audio.pickup();
    effects.ring(event.x, event.y, '#5cff8a');
    effects.floatText(event.x, event.y, event.kind.toUpperCase(), '#5cff8a');
  } else if (event.type === 'waveClear') {
    audio.waveClear();
    effects.floatText(640, 300, `WAVE ${event.wave} CLEAR  +${event.bonus}`, '#ffd166');
  } else if (event.type === 'victory') {
    audio.victory();
    for (let i = 0; i < 6; i += 1) effects.burst(200 + i * 180, 200 + (i % 2) * 260, '#ffd166', 24, 320);
  } else if (event.type === 'gameOver') {
    audio.gameOver();
    effects.burst(event.x, event.y, '#ff4f6d', 40, 380);
    effects.ring(event.x, event.y, '#ff4f6d');
    effects.shake(14);
  } else if (event.type === 'enemyShoot') {
    audio.enemyShoot();
  }
}

function runShot(name) {
  const scene = stageShot(name, world, effects);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let dashQueued = false;

  // Small read-only handle for automated playtests (and curious players).
  window.__neonVoid = { world, get screen() { return screen; }, get best() { return best; } };

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    audio.startMusic();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Survive ten waves.');
  }

  function finishRun() {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(world.state.victory
      ? `Victory. Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_DASH) dashQueued = true;
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY) startGame();
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      if (world.state.enemies.length === 0) world.spawnAmbient(7);
      world.step(STEP, { mx: 0, my: 0, aimX: 640, aimY: 300, firing: false, dash: false }, true);
      return;
    }
    const move = input.move();
    const aim = input.aim();
    const ctrl = { mx: move.x, my: move.y, aimX: aim.x, aimY: aim.y, firing: input.firing(), dash: dashQueued };
    dashQueued = false;
    const events = world.step(STEP, ctrl);
    for (const event of events) reactToEvent(event);
    if (world.state.over) { screen = SCREEN_OVER; finishRun(); }
    else if (world.state.victory) { screen = SCREEN_VICTORY; finishRun(); }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    effects.update(STEP);
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the swarm hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Void Starfall Arena. Press Enter or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
