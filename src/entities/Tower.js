// 타워 — 배치/조준/발사/업그레이드를 담당한다.

class Tower {
  constructor(scene, id, x, y) {
    this.scene = scene;
    this.id = id;
    this.def = TOWERS[id];
    this.accent = PALETTE[this.def.color];
    this.level = 1;
    this.x = x;
    this.y = y;
    this.cooldown = 0;
    this.currentAimAngle = -Math.PI / 2;

    this.hitRadius = 34; // 클릭 판정 반경 (GameScene의 전역 클릭 라우팅에서 사용)
    this.totalSpent = this.def.cost;

    this.container = scene.add.container(x, y);
    this.baseSprite = scene.add.sprite(0, 0, `tw_${id}_base`);
    this.turretSprite = scene.add.sprite(0, 0, `tw_${id}_turret`);

    // 등급 링 (레벨 2에서 1개, 레벨 3에서 2개 겹쳐 회전 — 눈에 띄게 강해 보이도록)
    this.tierRing1 = scene.add.sprite(0, 0, "tier_ring").setVisible(false).setBlendMode("ADD").setTint(this.accent);
    this.tierRing2 = scene.add.sprite(0, 0, "tier_ring").setVisible(false).setBlendMode("ADD").setTint(0xffffff).setAlpha(0.55);
    scene.tweens.add({ targets: this.tierRing1, angle: 360, duration: 7000, repeat: -1, ease: "Linear" });
    scene.tweens.add({ targets: this.tierRing2, angle: -360, duration: 4200, repeat: -1, ease: "Linear" });

    this.levelBadgeBg = scene.add.circle(18, 20, 9, this.accent, 0.95).setVisible(false).setStrokeStyle(1.5, 0xffffff, 0.7);
    this.levelBadgeText = scene.add.text(18, 20, "2", { fontFamily: "Segoe UI, sans-serif", fontSize: "11px", color: "#05070c", fontStyle: "bold" }).setOrigin(0.5).setVisible(false);

    this.container.add([this.tierRing1, this.tierRing2, this.baseSprite, this.turretSprite, this.levelBadgeBg, this.levelBadgeText]);
    this.container.setDepth(6 + y * 0.001);

    this.rangeGfx = scene.add.graphics().setDepth(4).setVisible(false);
    this._applyTierVisual();

    // 참고: 개별 오브젝트 인터랙션 대신, GameScene이 전역 pointerdown 하나로
    // 모든 타워 클릭을 라우팅한다 (여러 인터랙티브 오브젝트가 각자 이벤트를 올려
    // 서로 충돌/경합하는 문제를 피하기 위함 — 실제로 "타워 클릭이 잘 안 먹는"
    // 버그의 원인이었음).
    scene.towers.push(this);
  }

  get stats() {
    const d = this.def;
    const L = this.level;
    const dmgMult = UPGRADE.statMult[L - 1];
    return {
      damage: d.damage * dmgMult,
      range: d.range * UPGRADE.rangeMult[L - 1],
      fireRate: d.fireRate * UPGRADE.fireRateMult[L - 1],
      slowPct: d.slowPct ? Math.min(80, d.slowPct * dmgMult) : 0,
      slowDuration: d.slowDuration,
      pierceCount: d.pierceCount ? d.pierceCount + (L - 1) : 1,
      poisonDps: d.poisonDps ? d.poisonDps * dmgMult : 0,
      poisonDuration: d.poisonDuration,
      poisonMaxStacks: d.poisonMaxStacks,
      stunDuration: d.stunDuration ? d.stunDuration * dmgMult : 0,
      splashRadius: d.splashRadius ? d.splashRadius * (1 + (L - 1) * 0.12) : 0,
      projectileSpeed: d.projectileSpeed || 600,
    };
  }

  upgradeCost() {
    if (this.level >= 3) return null;
    return Math.round(this.def.cost * UPGRADE.costMult[this.level]);
  }

  sellValue() {
    return Math.round(this.totalSpent * 0.6);
  }

  upgrade() {
    if (this.level >= 3) return;
    const cost = this.upgradeCost();
    if (cost !== null) this.totalSpent += cost;
    this.level++;
    this._applyTierVisual();
    const targetScale = 1 + (this.level - 1) * 0.12;
    this.container.setScale(targetScale * 1.22);
    this.scene.tweens.add({ targets: this.container, scale: targetScale, duration: 260, ease: "Back.Out" });
    Fx.ring(this.x, this.y, this.accent, 50, 340);
    Fx.deathBurst(this.x, this.y, this.accent, false);
    Sfx.upgrade();
  }

  // 레벨에 따라 크기 / 등급 링 / 배지를 갱신한다 (업그레이드가 실제로 "강해 보이도록")
  _applyTierVisual() {
    const scale = 1 + (this.level - 1) * 0.12;
    this.container.setScale(scale);

    this.tierRing1.setVisible(this.level >= 2);
    if (this.level >= 2) this.tierRing1.setScale(0.56);

    this.tierRing2.setVisible(this.level >= 3);
    if (this.level >= 3) this.tierRing2.setScale(0.42);

    this.levelBadgeBg.setVisible(this.level >= 2);
    this.levelBadgeText.setVisible(this.level >= 2);
    if (this.level >= 2) this.levelBadgeText.setText(String(this.level));
  }

  showRange(show) {
    this.rangeGfx.setVisible(show);
    if (show) {
      this.rangeGfx.clear();
      this.rangeGfx.lineStyle(2, this.accent, 0.55);
      this.rangeGfx.fillStyle(this.accent, 0.07);
      this.rangeGfx.fillCircle(this.x, this.y, this.stats.range);
      this.rangeGfx.strokeCircle(this.x, this.y, this.stats.range);
    }
  }

  findTargetsInRange() {
    const r = this.stats.range;
    return this.scene.enemies.filter((e) => e.alive && Phaser.Math.Distance.Between(this.x, this.y, e.container.x, e.container.y) <= r);
  }

  findPriorityTargets(n) {
    const targets = this.findTargetsInRange();
    targets.sort((a, b) => b.progress - a.progress);
    return targets.slice(0, n);
  }

  update(dt) {
    this.cooldown -= dt;
    const aimTarget = this.findPriorityTargets(1)[0];
    if (aimTarget) {
      const ang = Phaser.Math.Angle.Between(this.x, this.y, aimTarget.container.x, aimTarget.container.y);
      this.currentAimAngle = Phaser.Math.Angle.RotateTo(this.currentAimAngle, ang, 0.25);
      this.turretSprite.rotation = this.currentAimAngle;
    }
    if (this.cooldown > 0) return;
    if (this._fire()) this.cooldown = 1 / this.stats.fireRate;
  }

  _tipPos() {
    return {
      x: this.x + Math.cos(this.currentAimAngle) * 24,
      y: this.y + Math.sin(this.currentAimAngle) * 24,
    };
  }

  // target을 쫓아가는 발사체를 만든다. onArrive(x, y, hit)는 실제로 도착한
  // "현재" 좌표를 받는다 — 발사 시점에 캡처해둔 낡은 좌표가 아니라 항상
  // 명중(혹은 대상 소멸) 시점의 실제 위치라서 이펙트가 엉뚱한 곳에 뜨지 않는다.
  _fireProjectile(key, target, speed, onArrive) {
    const tip = this._tipPos();
    const proj = this.scene.add.image(tip.x, tip.y, `pr_${this.id}`).setDepth(35);
    proj.rotation = Phaser.Math.Angle.Between(tip.x, tip.y, target.container.x, target.container.y);
    this.scene.projectiles.push({ sprite: proj, target, speed, x: tip.x, y: tip.y, onArrive });
    Fx.muzzleFlash(tip.x, tip.y, this.accent, this.currentAimAngle);
  }

  _fire() {
    const s = this.stats;
    const behavior = this.def.behavior;

    if (behavior === "single") {
      const target = this.findPriorityTargets(1)[0];
      if (!target) return false;
      this._fireProjectile("basic", target, s.projectileSpeed, (x, y, hit) => {
        if (hit) { target.takeDamage(s.damage, this.def.category); Fx.hitSpark(x, y, this.accent); }
      });
      Sfx.shoot("basic");
      return true;
    }

    if (behavior === "pierce") {
      const targets = this.findPriorityTargets(s.pierceCount);
      if (targets.length === 0) return false;
      const lead = targets[0];
      this._fireProjectile("sniper", lead, s.projectileSpeed, () => {
        // 관통은 맞은 각 대상의 "현재" 위치에서 개별적으로 이펙트가 터진다.
        // 주의: takeDamage()가 대상을 죽이면 그 즉시 container가 destroy()되므로,
        // 반드시 데미지를 주기 "전에" 좌표를 먼저 읽어둬야 한다 (죽고 난 뒤 읽으면
        // 이미 파괴된 오브젝트의 낡은/깨진 좌표를 읽게 되어 엉뚱한 곳에 이펙트가 뜬다).
        targets.forEach((t) => {
          if (!t.alive) return;
          const hx = t.container.x, hy = t.container.y;
          t.takeDamage(s.damage, this.def.category);
          Fx.hitSpark(hx, hy, this.accent);
        });
      });
      Sfx.shoot("sniper");
      return true;
    }

    if (behavior === "splash") {
      const target = this.findPriorityTargets(1)[0];
      if (!target) return false;
      this._fireProjectile("cannon", target, s.projectileSpeed, (x, y, hit) => {
        // 발사체 속도가 가장 느린 타워라, 날아가는 도중 다른 타워가 먼저
        // 목표를 죽이는 경우가 잦다. 그때 그냥 허공에서 터뜨리면 적과 상관없는
        // 곳에서 이펙트가 뜨는 것처럼 보이므로, 목표가 이미 죽었으면 조용히
        // 소멸시키고 폭발을 띄우지 않는다 (다른 타워들도 이미 이렇게 동작함).
        if (!hit) return;
        Fx.explosion(x, y, this.accent, s.splashRadius);
        Sfx.explosion();
        // slice()로 스냅샷을 떠서 순회 — takeDamage()가 적을 죽이면 그 안에서
        // scene.enemies 배열 자체를 splice()로 수정하기 때문에, 원본 배열을
        // 그대로 forEach 하면 다음 적을 건너뛸 수 있음.
        //
        // 중요: 폭발 중심(x,y)에는 큰 링/버스트가 뜨지만, 그 범위 안에서 같이
        // 맞은 "다른" 적들에게는 지금까지 아무 시각 효과도 없었다. 그래서
        // 여러 적이 뭉쳐 있을 때 플레이어가 보고 있던 적(원래 조준 대상이
        // 아닌 그 옆의 적)은 아무 반응이 없어 보이고, 정작 이펙트는 그 적이
        // 아닌 다른 곳(진짜 조준 대상 위치)에서 터진 것처럼 보여 "엉뚱한
        // 곳에서 터진다"는 착시가 생겼다. 맞은 적 각각의 "자기 위치"에도
        // 작은 스파크를 띄워서, 어떤 적을 보고 있어도 그 자리에서 맞는 게
        // 보이도록 한다 — 데미지를 주기 전에 좌표를 먼저 읽어서, 죽어서
        // container가 파괴된 뒤의 낡은 좌표를 읽는 일이 없게 한다.
        this.scene.enemies.slice().forEach((e) => {
          if (!e.alive) return;
          const ex = e.container.x, ey = e.container.y;
          if (Phaser.Math.Distance.Between(x, y, ex, ey) <= s.splashRadius) {
            Fx.hitSpark(ex, ey, this.accent);
            e.takeDamage(s.damage, this.def.category);
          }
        });
      });
      Sfx.shoot("cannon");
      return true;
    }

    if (behavior === "poison") {
      const target = this.findPriorityTargets(1)[0];
      if (!target) return false;
      this._fireProjectile("poison", target, s.projectileSpeed, (x, y, hit) => {
        if (hit) {
          target.takeDamage(s.damage, this.def.category);
          target.applyPoison(s.poisonDps, s.poisonDuration, s.poisonMaxStacks, this.def.category);
          Fx.poisonPuff(x, y, this.accent);
        }
      });
      Sfx.shoot("poison");
      return true;
    }

    if (behavior === "slow") {
      const targets = this.findTargetsInRange();
      if (targets.length === 0) return false;
      targets.forEach((e) => e.applySlow(s.slowPct, this.def.category));
      Fx.frostPulse(this.x, this.y, this.accent, s.range);
      Sfx.shoot("frost");
      return true;
    }

    if (behavior === "stun") {
      const target = this.findPriorityTargets(1)[0];
      if (!target) return false;
      target.takeDamage(s.damage, this.def.category);
      target.applyStun(s.stunDuration, this.def.category);
      Fx.teslaArc(this.x, this.y, target.container.x, target.container.y, this.accent);
      Sfx.shoot("tesla");
      return true;
    }

    return false;
  }

  destroy() {
    this.container.destroy();
    this.rangeGfx.destroy();
  }
}
