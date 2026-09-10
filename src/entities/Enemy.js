// 적 유닛 — 경로를 따라 이동하고 상태이상(슬로우/스턴/독)을 처리한다.

const ENEMY_DISPLAY_SCALE = 0.62;

class Enemy {
  constructor(scene, typeId, hpMult = 1) {
    this.scene = scene;
    this.def = ENEMIES[typeId];
    this.type = typeId;
    this.distance = 0;
    this.baseSpeed = this.def.speed;
    this.speed = this.def.speed;
    this.maxHp = Math.round(this.def.hp * hpMult);
    this.hp = this.maxHp;
    this.reward = this.def.reward;
    this.dodges = this.def.dodges || [];
    this.slowResist = this.def.slowResist || 0;
    this.stunResist = this.def.stunResist || 0;
    this.isBoss = !!this.def.isBoss;

    this.slowTimer = 0;
    this.stunTimer = 0;
    this.poisonStacks = [];
    this.alive = true;
    this.progress = 0;
    this._t = Math.random() * 10;

    const scale = ENEMY_DISPLAY_SCALE * (this.def.scale || 1);
    this.container = scene.add.container(0, 0);
    this.sprite = scene.add.sprite(0, 0, `en_${typeId}`).setScale(scale);
    this.container.add(this.sprite);

    const barW = this.isBoss ? 56 : 30;
    this.barW = barW;
    this.hpBarBg = scene.add.rectangle(0, -this._hpBarY(), barW, 5, 0x000000, 0.55).setOrigin(0.5);
    this.hpBarFg = scene.add.rectangle(-barW / 2, -this._hpBarY(), barW, 5, PALETTE.good).setOrigin(0, 0.5);
    this.container.add([this.hpBarBg, this.hpBarFg]);

    const iconY = -this._hpBarY() - 12;
    this.iconSlow = scene.add.sprite(0, iconY, "ic_slow").setScale(0.7).setVisible(false);
    this.iconPoison = scene.add.sprite(0, iconY, "ic_poison").setScale(0.7).setVisible(false);
    this.iconStun = scene.add.sprite(0, iconY, "ic_stun").setScale(0.7).setVisible(false);
    this.container.add([this.iconSlow, this.iconPoison, this.iconStun]);

    this.container.setDepth(10);
    scene.enemyLayer.add(this.container);
    scene.enemies.push(this);

    this._placeAt(0);
  }

  _hpBarY() {
    return (this.isBoss ? 60 : 26);
  }

  update(dt) {
    if (!this.alive) return;
    this._t += dt;

    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
    } else {
      if (this.slowTimer > 0) {
        this.slowTimer -= dt;
        if (this.slowTimer <= 0) this.speed = this.baseSpeed;
      }
      this.distance += this.speed * dt;
      this._placeAt(this.distance);
    }

    this._processPoison(dt);
    this._updateStatusIcon();

    if (this.def.ghost) {
      this.sprite.setAlpha(0.68 + Math.sin(this._t * 3) * 0.12);
    }
    if (this.isBoss) {
      const s = ENEMY_DISPLAY_SCALE * this.def.scale * (1 + Math.sin(this._t * 2.2) * 0.02);
      this.sprite.setScale(s);
    }

    if (this.progress >= 1) {
      this.scene.onEnemyLeaked(this);
      this.destroy();
    }
  }

  _placeAt(dist) {
    const p = this.scene.path.getPointAt(dist);
    this.container.setPosition(p.x, p.y);
    this.sprite.rotation = p.angle;
    this.progress = Phaser.Math.Clamp(dist / this.scene.path.totalLength, 0, 1);
  }

  _processPoison(dt) {
    if (this.poisonStacks.length === 0) return;
    let totalDps = 0;
    for (const s of this.poisonStacks) { totalDps += s.dps; s.timer -= dt; }
    this.poisonStacks = this.poisonStacks.filter((s) => s.timer > 0);
    if (totalDps > 0) this._applyDamage(totalDps * dt);
  }

  _updateStatusIcon() {
    this.iconStun.setVisible(this.stunTimer > 0);
    this.iconPoison.setVisible(this.stunTimer <= 0 && this.poisonStacks.length > 0);
    this.iconSlow.setVisible(this.stunTimer <= 0 && this.poisonStacks.length === 0 && this.slowTimer > 0);
  }

  takeDamage(amount, category = "physical") {
    if (!this.alive) return;
    if (this.dodges.includes(category)) {
      this.scene.spawnDodgeText(this.container.x, this.container.y);
      return;
    }
    this._applyDamage(amount);
  }

  _applyDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this._updateHpBar();
    if (this.hp <= 0) {
      this.scene.onEnemyKilled(this);
      this.destroy();
    }
  }

  applySlow(pct, category = "control") {
    if (!this.alive || this.dodges.includes(category)) return;
    const eff = pct * (1 - this.slowResist);
    this.speed = this.baseSpeed * (1 - eff / 100);
    this.slowTimer = 1.2;
  }

  applyStun(duration, category = "control") {
    if (!this.alive || this.dodges.includes(category)) return;
    const eff = duration * (1 - this.stunResist);
    this.stunTimer = Math.max(this.stunTimer, eff);
  }

  applyPoison(dps, duration, maxStacks, category = "area") {
    if (!this.alive || this.dodges.includes(category)) return;
    this.poisonStacks.push({ dps, timer: duration });
    while (this.poisonStacks.length > maxStacks) this.poisonStacks.shift();
  }

  _updateHpBar() {
    const ratio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    this.hpBarFg.width = this.barW * ratio;
    const color = ratio > 0.5 ? PALETTE.good : ratio > 0.25 ? PALETTE.warn : PALETTE.danger;
    this.hpBarFg.setFillStyle(color);
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    const idx = this.scene.enemies.indexOf(this);
    if (idx >= 0) this.scene.enemies.splice(idx, 1);
    this.container.destroy();
  }
}
