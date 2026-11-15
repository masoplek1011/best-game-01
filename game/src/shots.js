// The screenshot scenes behind ?shot=title|play|gameover|victory. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (flee the nearest enemy, aim at the nearest enemy, fire),
// so the frame is what a real game looks like and the same seed always gives the
// same frame. The victory scene stages a finished winning run through the
// world's own stageVictory, then lets the celebration particles bloom.

import { FIELD, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const TITLE_SECONDS = 5;
const PLAY_SECONDS = 19;
const END_LIMIT_SECONDS = 180;

function nearestEnemy(state) {
  let best = null;
  let bestDistance = Infinity;
  for (const enemy of state.enemies) {
    const distance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
    if (distance < bestDistance) { bestDistance = distance; best = enemy; }
  }
  return { enemy: best, distance: bestDistance };
}

/** Steer away from the nearest enemy and shoot at it; stand still when `brave` is false. */
function autopilot(state, brave) {
  const player = state.player;
  const { enemy } = nearestEnemy(state);
  if (!enemy) return { mx: 0, my: 0, aimX: player.x, aimY: player.y - 100, firing: false, dash: false };
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const flee = brave ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };
  // Drift back toward the centre so the pilot does not hug a wall.
  const centre = { x: (FIELD.width / 2 - player.x) / FIELD.width, y: (FIELD.height / 2 - player.y) / FIELD.height };
  return {
    mx: Math.max(-1, Math.min(1, flee.x + centre.x)),
    my: Math.max(-1, Math.min(1, flee.y + centre.y)),
    aimX: enemy.x,
    aimY: enemy.y,
    firing: brave,
    dash: false,
  };
}

/**
 * Set `world` to the named scene (title, play, gameover or victory; any other name
 * is title) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world, effects) {
  if (name === 'victory') {
    world.stageVictory();
    for (let i = 0; i < 5; i += 1) {
      effects.burst(240 + i * 200, 220 + (i % 2) * 200, ['#4dffd2', '#ffd166', '#ff4fd8'][i % 3], 26, 300);
      effects.ring(240 + i * 200, 220 + (i % 2) * 200, '#ffd166');
    }
    return { screen: SCREEN_VICTORY, best: 2450 };
  }

  world.reset();
  if (name !== 'play' && name !== 'gameover') {
    world.spawnAmbient(7);
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) world.step(STEP, { mx: 0, my: 0, aimX: 640, aimY: 300, firing: false, dash: false }, true);
    return { screen: SCREEN_TITLE, best: 1250 };
  }

  const brave = name === 'play';
  const limit = brave ? PLAY_SECONDS : END_LIMIT_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    // The game-over pilot fights bravely for the first seconds, then gives up
    // and stands still, so the loss screen shows a real run's score and kills.
    const elapsed = i * STEP;
    const fighting = brave || elapsed < 8;
    const events = world.step(STEP, autopilot(world.state, fighting));
    for (const event of events) {
      if (event.type === 'enemyDied') {
        effects.burst(event.x, event.y, '#ff4fd8', 14, 240);
        effects.floatText(event.x, event.y, `+${event.score}`, '#ffd166');
      }
      if (event.type === 'hit') effects.burst(event.x, event.y, '#ffe45e', 3, 140);
      if (event.type === 'gameOver') break;
    }
    if (world.state.over) break;
  }
  if (world.state.over) return { screen: SCREEN_OVER, best: Math.max(1250, world.state.score) };
  return { screen: SCREEN_PLAY, best: 1250 };
}
