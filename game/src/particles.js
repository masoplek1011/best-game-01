// Particles, floating score text, shockwave rings and screen shake. The world
// asks for bursts and rings; this module owns their lifetimes and draws them.
// Nothing here knows about rules or screens.

export function createEffects() {
  const particles = [];
  const texts = [];
  const rings = [];
  let shakeAmount = 0;

  return {
    burst(x, y, color, count, speed = 260) {
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = speed * (0.3 + Math.random() * 0.7);
        particles.push({
          x, y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life: 0.45 + Math.random() * 0.5,
          age: 0,
          size: 2 + Math.random() * 4,
          color,
        });
      }
    },
    ring(x, y, color) {
      rings.push({ x, y, age: 0, life: 0.45, color, maxRadius: 90 });
    },
    floatText(x, y, value, color) {
      texts.push({ x, y, value, color, age: 0, life: 0.9 });
    },
    shake(amount) {
      shakeAmount = Math.min(18, shakeAmount + amount);
    },
    /** The current shake offset; decays every frame. */
    offset() {
      shakeAmount *= 0.88;
      if (shakeAmount < 0.2) return { x: 0, y: 0 };
      return {
        x: (Math.random() * 2 - 1) * shakeAmount,
        y: (Math.random() * 2 - 1) * shakeAmount,
      };
    },
    update(dt) {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
        if (p.age >= p.life) particles.splice(i, 1);
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        const t = texts[i];
        t.age += dt;
        t.y -= 42 * dt;
        if (t.age >= t.life) texts.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const r = rings[i];
        r.age += dt;
        if (r.age >= r.life) rings.splice(i, 1);
      }
    },
    draw(ctx) {
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      for (const r of rings) {
        const progress = r.age / r.life;
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 8 + progress * r.maxRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      for (const t of texts) {
        ctx.globalAlpha = Math.max(0, 1 - t.age / t.life);
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.fillStyle = t.color;
        ctx.fillText(t.value, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    },
  };
}
