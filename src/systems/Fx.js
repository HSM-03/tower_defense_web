// 이펙트 헬퍼 — 파티클/링/번개 등 모든 시각 효과를 이 모듈에서 생성한다.

const Fx = {
  scene: null,
  init(scene) { this.scene = scene; },

  // 예전엔 Phaser의 ParticleEmitter(add.particles + explode)로 만들었는데,
  // 폭발/사망 이펙트가 "엉뚱한 곳"에서 뜬다는 신고가 계속 있었고, 좌표값
  // 자체(로그)는 항상 정확한데도 재현되어 — 파티클 이미터 내부 렌더링
  // 경로 자체를 의심하게 됐다. 이미 muzzleFlash/hitSpark/poisonPuff에서
  // 검증된(그리고 사용자가 사진으로 위치 정확함을 확인해준) 방식인 "이미지
  // 여러 개 + 트윈"으로 완전히 교체해서, 이 가능성 자체를 원천 차단한다.
  _burst(x, y, texture, colorHex, count, opts = {}) {
    const lifespan = opts.lifespan || 320;
    const speedMin = (opts.speed && opts.speed.min) || 40;
    const speedMax = (opts.speed && opts.speed.max) || 140;
    const startScale = opts.startScale || 0.9;
    const depth = opts.depth || 40;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      const dist = speed * (lifespan / 1000);
      const s = this.scene.add.image(x, y, texture).setDepth(depth).setBlendMode("ADD")
        .setTint(colorHex).setScale(startScale).setAlpha(1);
      if (opts.rotate) s.setRotation(a);
      const target = {
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist,
        scale: 0,
        alpha: 0,
      };
      if (opts.rotate) target.rotation = a + Math.PI * 2 * (Math.random() < 0.5 ? 1 : -1);
      this.scene.tweens.add({
        targets: s, ...target, duration: lifespan, ease: "Cubic.Out",
        onComplete: () => s.destroy(),
      });
    }
  },

  // 매 발사/피격마다 호출되는 두 효과는 파티클 이미터를 새로 만들고 부수는 대신
  // (이미터 생성/파괴 자체가 무거워서, 타워가 많아지면 렉의 주범이었음)
  // 이미지 1~2개 + 트윈만으로 가볍게 처리한다.
  muzzleFlash(x, y, colorHex, angle) {
    const s = this.scene.add.image(x, y, "p_dot").setDepth(40).setBlendMode("ADD")
      .setTint(colorHex).setScale(0.45).setAlpha(0.95).setRotation(angle || 0);
    this.scene.tweens.add({ targets: s, scale: 0.85, alpha: 0, duration: 110, ease: "Cubic.Out", onComplete: () => s.destroy() });
  },

  hitSpark(x, y, colorHex) {
    const core = this.scene.add.image(x, y, "p_dot").setDepth(40).setBlendMode("ADD")
      .setTint(colorHex).setScale(0.55).setAlpha(1);
    this.scene.tweens.add({ targets: core, scale: 1.1, alpha: 0, duration: 160, ease: "Cubic.Out", onComplete: () => core.destroy() });
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = this.scene.add.image(x, y, "p_spark").setDepth(40).setBlendMode("ADD")
        .setTint(colorHex).setScale(0.6).setAlpha(0.9).setRotation(a);
      this.scene.tweens.add({
        targets: s, x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14, alpha: 0, duration: 150,
        ease: "Cubic.Out", onComplete: () => s.destroy(),
      });
    }
  },

  ring(x, y, colorHex, radius, duration = 320) {
    const s = this.scene.add.image(x, y, "p_ring").setDepth(39);
    s.setTint(colorHex);
    s.setBlendMode("ADD");
    s.setScale(0.15);
    s.setAlpha(0.9);
    this.scene.tweens.add({
      targets: s, scale: radius / 32, alpha: 0, duration, ease: "Cubic.Out",
      onComplete: () => s.destroy(),
    });
  },

  explosion(x, y, colorHex, radius = 70) {
    this.ring(x, y, colorHex, radius, 340);
    this._burst(x, y, "p_dot", colorHex, 14, { lifespan: 380, speed: { min: 80, max: 240 }, startScale: 1.0 });
    this._burst(x, y, "p_shard", 0xffffff, 8, { lifespan: 300, speed: { min: 60, max: 180 }, startScale: 0.7, rotate: { min: 0, max: 360 } });
    this.scene.cameras.main.shake(120, 0.0035);
  },

  poisonPuff(x, y, colorHex) {
    for (let i = 0; i < 3; i++) {
      const ox = (Math.random() - 0.5) * 12, oy = (Math.random() - 0.5) * 12;
      const s = this.scene.add.image(x + ox, y + oy, "p_dot").setDepth(40).setBlendMode("ADD")
        .setTint(colorHex).setScale(0.5 + Math.random() * 0.3).setAlpha(0.8);
      this.scene.tweens.add({
        targets: s, y: s.y - 16 - Math.random() * 10, alpha: 0, scale: s.scale * 1.3, duration: 450 + Math.random() * 150,
        ease: "Sine.Out", onComplete: () => s.destroy(),
      });
    }
  },

  frostPulse(x, y, colorHex, radius) {
    this.ring(x, y, colorHex, radius, 380);
    this._burst(x, y, "p_shard", colorHex, 10, { lifespan: 340, speed: { min: 40, max: 130 }, startScale: 0.6, rotate: { min: 0, max: 360 } });
  },

  teslaArc(x1, y1, x2, y2, colorHex) {
    const g = this.scene.add.graphics().setDepth(41);
    const draw = () => {
      g.clear();
      g.lineStyle(2.4, colorHex, 1);
      const segs = 7;
      let px = x1, py = y1;
      g.beginPath();
      g.moveTo(px, py);
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const bx = Phaser.Math.Linear(x1, x2, t);
        const by = Phaser.Math.Linear(y1, y2, t);
        const jitter = (i === segs) ? 0 : 10;
        px = bx + (Math.random() * 2 - 1) * jitter;
        py = by + (Math.random() * 2 - 1) * jitter;
        g.lineTo(px, py);
      }
      g.strokePath();
    };
    draw();
    let n = 0;
    const timer = this.scene.time.addEvent({
      delay: 24, repeat: 4, callback: () => {
        n++;
        if (n >= 4) { g.setAlpha(1 - n / 5); }
        draw();
        g.setAlpha(1 - n * 0.22);
      },
    });
    this.scene.time.delayedCall(150, () => { g.destroy(); timer.remove(false); });
    this._burst(x2, y2, "p_spark", colorHex, 5, { lifespan: 180, speed: { min: 40, max: 120 } });
  },

  deathBurst(x, y, colorHex, big = false) {
    const n = big ? 26 : 12;
    this._burst(x, y, "p_dot", colorHex, n, { lifespan: big ? 520 : 320, speed: { min: 50, max: big ? 260 : 170 }, startScale: big ? 1.3 : 0.9 });
    this._burst(x, y, "p_shard", 0xffffff, big ? 14 : 6, { lifespan: 400, speed: { min: 60, max: 200 }, startScale: 0.7, rotate: { min: 0, max: 360 } });
    if (big) this.scene.cameras.main.shake(220, 0.006);
  },

  floatText(x, y, text, colorCss, opts = {}) {
    const t = this.scene.add.text(x, y, text, {
      fontFamily: "Segoe UI, sans-serif", fontSize: opts.size || "15px", color: colorCss,
      fontStyle: "bold", stroke: "#04070c", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(60);
    this.scene.tweens.add({
      targets: t, y: y - (opts.rise || 34), alpha: 0, duration: opts.duration || 700, ease: "Cubic.Out",
      onComplete: () => t.destroy(),
    });
  },
};
