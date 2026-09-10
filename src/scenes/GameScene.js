const PLACEMENT = { pathMargin: 44, maxPathDistance: 108, towerSpacing: 46, playTop: 64, playBottom: 650 };
const DECK_RADIUS = 150; // 경로를 감싸는 갑판(섬)의 폭 — 가운데는 확실히 땅, 반대쪽 모서리는 우주 (요청으로 살짝 확대)

class GameScene extends Phaser.Scene {
  constructor() { super("GameScene"); }

  create() {
    this.over = false;
    this.gold = ECONOMY.startingGold;
    this.life = ECONOMY.startingLife;
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.selectedBuildType = null;
    this.selectedTower = null;
    this.speedMult = 1;

    Fx.init(this);
    Sfx.setMusicMode("game");

    this.path = new GamePath(PATH_WAYPOINTS);
    this._buildBackground();
    this._buildDecorations();
    drawPathGraphics(this, this.path);
    this._buildGates();

    this.enemyLayer = this.add.layer().setDepth(10);

    this._buildGhost();

    this.waveManager = new WaveManager(this);

    this.cameras.main.fadeIn(450, 4, 6, 10);

    this.input.on("pointerdown", (p) => this._onPointerDown(p));
    this.input.on("pointermove", (p) => this._onPointerMove(p));
    this.input.keyboard.on("keydown", (e) => this._onKeyDown(e));

    this.scene.launch("UIScene", { gameScene: this });
    this.ui = this.scene.get("UIScene");

    this.time.delayedCall(1000, () => this.waveManager.start());
  }

  _buildBackground() {
    drawSpaceField(this, 1280, 720, 1337).setDepth(0);

    // 먼 배경 행성 2개 — 가장 뒤쪽(별보다도 아래)에 큼직하게, 아주 천천히 자전
    const p1 = this.add.image(150, 560, "prop_planet1").setDepth(0.05).setAlpha(0.8).setScale(1.15);
    const p2 = this.add.image(1140, 130, "prop_planet2").setDepth(0.05).setAlpha(0.75).setScale(0.85);
    this.tweens.add({ targets: p1, angle: 360, duration: 90000, repeat: -1, ease: "Linear" });
    this.tweens.add({ targets: p2, angle: -360, duration: 70000, repeat: -1, ease: "Linear" });

    // 은은한 성운 뭉게구름 (아주 멀리, 큼직하게)
    this.add.image(1080, 560, "prop_nebula1").setDepth(0.04).setAlpha(0.5).setScale(1.3);
    this.add.image(160, 150, "prop_nebula2").setDepth(0.04).setAlpha(0.45).setScale(1.1);

    drawStationDeck(this, this.path, DECK_RADIUS, 77).setDepth(0.4);
  }

  _buildDecorations() {
    const rng = mulberry32(2024);

    // 포탈 옆에만 작게 크레이트를 붙인다 (갑판이 좁아져서 일반 배치 공간이 거의 없음)
    const first = this.path.points[0], last = this.path.points[this.path.points.length - 1];
    [[first.x + 30, first.y - 40], [last.x - 30, last.y - 40]].forEach(([x, y], i) => {
      this.add.image(x, y, i === 0 ? "prop_crate1" : "prop_crate2").setDepth(0.5 + y * 0.0001).setScale(0.9);
    });

    // 갑판 밖 우주 공간에는 다양한 소품(바위/얼음/잔해)을 넉넉하게, 색조도 살짝씩 바꿔가며 흩뿌린다
    // (요청: 전부 똑같은 걸 복붙한 것처럼 보이지 않도록)
    const voidPts = [];
    const voidProps = [
      "prop_asteroid", "prop_asteroid", "prop_asteroid2", "prop_asteroid3",
      "prop_ice", "prop_ice", "prop_wreck",
    ];
    // 예전엔 흰색/크림색 계열 틴트가 섞여 있었는데, 회전하면서 하이라이트가
    // 도는 순간 밝고 따뜻한 색으로 반짝여서 타워 폭발 이펙트(주황/흰색)와
    // 착각하기 쉬웠다. 그래서 소행성 틴트는 차갑고 어두운 톤으로만 제한하고,
    // 밝기(알파)도 낮춰서 우주 배경 소품이 절대 "이펙트처럼" 번쩍이지 않게 함.
    const rockTints = [0x9aa8c8, 0x8a90b8, 0xa8b0c8, 0x8098a8];
    let voidPlaced = 0, voidAttempts = 0;
    while (voidPlaced < 30 && voidAttempts < 900) {
      voidAttempts++;
      const x = rng() * 1280, y = PLACEMENT.playTop + rng() * (PLACEMENT.playBottom - PLACEMENT.playTop);
      if (this.path.closestDistanceTo(x, y) < DECK_RADIUS + 14) continue;
      if (!voidPts.every((p) => Phaser.Math.Distance.Between(x, y, p.x, p.y) >= 78)) continue;
      const key = voidProps[Math.floor(rng() * voidProps.length)];
      const img = this.add.image(x, y, key).setDepth(0.3).setAlpha(0.45 + rng() * 0.25);
      img.setScale(0.4 + rng() * 0.85);
      if (key.startsWith("prop_asteroid")) img.setTint(rockTints[Math.floor(rng() * rockTints.length)]);
      const spinDur = key === "prop_wreck" ? 30000 + rng() * 20000 : 16000 + rng() * 18000;
      this.tweens.add({ targets: img, angle: rng() < 0.5 ? 360 : -360, duration: spinDur, repeat: -1, ease: "Linear" });
      voidPts.push({ x, y });
      voidPlaced++;
    }

    // 반짝이는 우주 먼지 (작은 트윙클 도트) — 최대 밝기를 낮춰서 타워
    // 폭발/피격 이펙트와 헷갈리지 않도록 함.
    for (let i = 0; i < 46; i++) {
      const x = rng() * 1280, y = PLACEMENT.playTop + rng() * (PLACEMENT.playBottom - PLACEMENT.playTop);
      if (this.path.closestDistanceTo(x, y) < DECK_RADIUS) continue;
      const d = this.add.image(x, y, "prop_debris").setDepth(0.32).setAlpha(0.15).setScale(0.45 + rng() * 0.55);
      this.tweens.add({
        targets: d, alpha: { from: 0.1, to: 0.4 }, duration: 900 + rng() * 1400,
        yoyo: true, repeat: -1, delay: rng() * 2000, ease: "Sine.InOut",
      });
    }
  }

  _buildGates() {
    const start = this.path.points[0];
    const end = this.path.points[this.path.points.length - 1];
    this.startGate = this._gateSprite(start.x, start.y, "start", "prop_crystal_r");
    this.endGate = this._gateSprite(end.x, end.y, "end", "prop_crystal_p");
  }

  _gateSprite(x, y, key, crystalKey) {
    [[-38, 26], [40, 24], [-8, 34]].forEach(([dx, dy]) => {
      this.add.image(x + dx, y + dy, crystalKey).setDepth(1.9).setScale(1.1);
    });
    const frame = this.add.image(x, y, `portal_${key}_frame`).setDepth(2);
    const swirl = this.add.image(x, y, `portal_${key}_swirl`).setDepth(2.1).setScale(0.7);
    this.tweens.add({ targets: swirl, angle: 360, duration: 4000, repeat: -1, ease: "Linear" });
    this.tweens.add({ targets: swirl, scale: { from: 0.62, to: 0.78 }, duration: 1000, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    return { frame, swirl };
  }

  _buildGhost() {
    this.ghost = this.add.container(0, 0).setDepth(45).setVisible(false);
    this.ghostBase = this.add.sprite(0, 0, "tw_basic_base").setAlpha(0.75);
    this.ghostTurret = this.add.sprite(0, 0, "tw_basic_turret").setAlpha(0.75);
    this.ghostRange = this.add.graphics();
    this.ghost.add([this.ghostRange, this.ghostBase, this.ghostTurret]);
  }

  // ================= 입력 =================
  setBuildType(id) {
    this.selectedBuildType = id;
    this.deselectTower();
    this.ghost.setVisible(true);
    this.ghostBase.setTexture(`tw_${id}_base`);
    this.ghostTurret.setTexture(`tw_${id}_turret`);
  }

  cancelBuild() {
    this.selectedBuildType = null;
    this.ghost.setVisible(false);
    if (this.ui) this.ui.clearBuildSelection();
  }

  deselectTower() {
    if (this.selectedTower) this.selectedTower.showRange(false);
    this.selectedTower = null;
  }

  onTowerClicked(tower) {
    this.cancelBuild();
    if (this.selectedTower === tower) { this.deselectTower(); return; }
    this.deselectTower();
    this.selectedTower = tower;
    tower.showRange(true);
  }

  sellTower(tower) {
    const idx = this.towers.indexOf(tower);
    if (idx < 0) return;
    const refund = tower.sellValue();
    this.gold += refund;
    Fx.floatText(tower.x, tower.y - 20, `+${refund}G`, "#ffd76b");
    Sfx.place();
    this.towers.splice(idx, 1);
    if (this.selectedTower === tower) this.selectedTower = null;
    tower.destroy();
  }

  _inPlayArea(x, y) {
    return y > PLACEMENT.playTop && y < PLACEMENT.playBottom && x > 4 && x < 1276;
  }

  canPlace(x, y) {
    if (!this._inPlayArea(x, y)) return { ok: false, reason: "영역 밖" };
    const d = this.path.closestDistanceTo(x, y);
    if (d < PLACEMENT.pathMargin) return { ok: false, reason: "경로 위" };
    if (d > PLACEMENT.maxPathDistance) return { ok: false, reason: "경로에서 너무 멂" };
    for (const t of this.towers) {
      if (Phaser.Math.Distance.Between(t.x, t.y, x, y) < PLACEMENT.towerSpacing) return { ok: false, reason: "타워와 너무 가까움" };
    }
    return { ok: true };
  }

  _onPointerMove(p) {
    if (!this.selectedBuildType) return;
    this.ghost.setPosition(p.x, p.y);
    const check = this.canPlace(p.x, p.y);
    const def = TOWERS[this.selectedBuildType];
    const range = def.range;
    this.ghostRange.clear();
    this.ghostRange.fillStyle(check.ok ? PALETTE.good : PALETTE.danger, 0.1);
    this.ghostRange.lineStyle(2, check.ok ? PALETTE.good : PALETTE.danger, 0.7);
    this.ghostRange.fillCircle(0, 0, range);
    this.ghostRange.strokeCircle(0, 0, range);
    const tint = check.ok ? 0x9fffc0 : 0xff9f9f;
    this.ghostBase.setTint(tint);
    this.ghostTurret.setTint(tint);
  }

  _onPointerDown(p) {
    Sfx.unlock();
    if (p.y >= PLACEMENT.playBottom - 4 || p.y <= PLACEMENT.playTop) return; // UI 영역 클릭은 무시
    if (this._isOverUiPanel(p.x, p.y)) return; // 업그레이드/판매 패널 위 클릭도 무시 (게임 월드로 새지 않게)

    if (this.selectedBuildType) {
      this._tryPlace(p.x, p.y);
      return;
    }

    // 전역 핸들러 하나로만 타워 클릭을 처리한다 (개별 오브젝트 pointerdown과
    // 씬 전역 pointerdown이 같은 클릭에 동시에 반응해 "선택 즉시 해제"되던
    // 버그를 막기 위함 — 타워는 더 이상 자체 인터랙션을 갖지 않는다).
    const hitTower = this._towerAt(p.x, p.y);
    if (hitTower) {
      this.onTowerClicked(hitTower);
    } else {
      this.deselectTower();
    }
  }

  _isOverUiPanel(x, y) {
    const panel = this.ui && this.ui.panel;
    if (!panel || !panel.visible) return false;
    return x >= panel.x && x <= panel.x + this.ui.panelW && y >= panel.y && y <= panel.y + this.ui.panelH;
  }

  _towerAt(x, y) {
    let best = null, bestDist = Infinity;
    for (const t of this.towers) {
      const d = Phaser.Math.Distance.Between(t.x, t.y, x, y);
      if (d <= t.hitRadius && d < bestDist) { best = t; bestDist = d; }
    }
    return best;
  }

  _onKeyDown(e) {
    if (e.key === "Escape") { this.cancelBuild(); this.deselectTower(); }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= TOWER_ORDER.length) this.ui.selectBuildButton(n - 1);
  }

  _tryPlace(x, y) {
    const def = TOWERS[this.selectedBuildType];
    const check = this.canPlace(x, y);
    if (!check.ok) {
      Sfx.error();
      Fx.floatText(x, y - 20, check.reason, "#ff6b6b");
      this._shakeGhost();
      return;
    }
    if (this.gold < def.cost) {
      Sfx.error();
      Fx.floatText(x, y - 20, "골드 부족", "#ff6b6b");
      this._shakeGhost();
      return;
    }
    const tower = new Tower(this, this.selectedBuildType, x, y);
    this.gold -= def.cost;
    Sfx.place();
    Fx.ring(x, y, PALETTE[def.color], 44, 260);

    // 설치 후에는 배치 모드를 해제한다 — 계속 선택된 상태로 남아있으면
    // 이미 설치한 타워를 클릭해도 항상 "새 타워 설치 시도"로만 처리되어
    // 업그레이드/판매 패널을 영영 열 수 없게 되는 문제가 있었음.
    this.cancelBuild();
  }

  _shakeGhost() {
    this.tweens.add({ targets: this.ghost, x: this.ghost.x + 4, duration: 40, yoyo: true, repeat: 3 });
  }

  // ================= 게임 이벤트 =================
  onWaveStart(waveNum, wave) {
    Sfx.waveStart();
    this.ui.showBanner(`웨이브 ${waveNum} / ${WAVES.length}`, wave.boss ? PALETTE.danger : PALETTE.pathGlow);
    if (wave.boss) {
      Sfx.bossAlert();
      this.time.delayedCall(400, () => this.ui.showBanner("⚠ 보스 출현 ⚠", PALETTE.danger, true));
      const ease = Phaser.Math.Easing.Sine.InOut;
      this.cameras.main.zoomTo(1.04, 200, ease, true, () => this.cameras.main.zoomTo(1, 260, ease));
    }
  }

  onEnemySpawned() {}

  onEnemyKilled(enemy) {
    this.gold += enemy.reward;
    Fx.deathBurst(enemy.container.x, enemy.container.y, PALETTE[enemy.def.color], enemy.isBoss);
    Fx.floatText(enemy.container.x, enemy.container.y - 18, `+${enemy.reward}G`, "#ffd76b");
    Sfx.enemyDeath();
  }

  onEnemyLeaked(enemy) {
    this.life--;
    Sfx.lifeLost();
    Fx.ring(this.endGate ? this.path.points[this.path.points.length - 1].x : enemy.container.x,
      this.path.points[this.path.points.length - 1].y, PALETTE.danger, 60, 300);
    this.cameras.main.shake(140, 0.004);
    if (this.life <= 0) this.gameOver(false);
  }

  onAllWavesCleared() {
    this.gameOver(true);
  }

  spawnDodgeText(x, y) {
    Fx.floatText(x, y - 20, "MISS", "#c0d0ff");
  }

  gameOver(win) {
    if (this.over) return;
    this.over = true;
    Sfx[win ? "gameOverWin" : "gameOverLose"]();
    this.time.delayedCall(500, () => {
      this.scene.pause();
      this.scene.launch("GameOverScene", {
        win, waveReached: this.waveManager.waveIndex, totalWaves: WAVES.length,
        towerCount: this.towers.length,
      });
    });
  }

  toggleSpeed() {
    this.speedMult = this.speedMult === 1 ? 2 : 1;
    this.tweens.timeScale = this.speedMult;
    this.time.timeScale = this.speedMult;
    return this.speedMult;
  }

  update(time, delta) {
    if (this.over) return;
    const dt = (delta / 1000) * this.speedMult;
    for (const e of this.enemies.slice()) e.update(dt);
    for (const t of this.towers) t.update(dt);
    this._updateProjectiles(dt);
    this.waveManager.update(dt);
  }

  // 발사체를 매 프레임 직접 이동시킨다(트윈으로 고정 좌표까지 날아가지 않고
  // 대상의 "현재" 위치를 계속 쫓아감) — 피격/사망 이펙트가 목표물이 발사 시점에
  // 있던 낡은 위치가 아니라 실제로 맞은 위치에 나오도록 하기 위함.
  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const liveTarget = p.target && p.target.alive ? p.target : null;
      const tx = liveTarget ? liveTarget.container.x : p.x;
      const ty = liveTarget ? liveTarget.container.y : p.y;
      const dist = Phaser.Math.Distance.Between(p.x, p.y, tx, ty);
      const step = p.speed * dt;

      if (!liveTarget || dist <= step) {
        p.x = tx; p.y = ty;
        p.sprite.destroy();
        this.projectiles.splice(i, 1);
        p.onArrive(p.x, p.y, !!liveTarget);
        continue;
      }
      const ang = Math.atan2(ty - p.y, tx - p.x);
      p.x += Math.cos(ang) * step;
      p.y += Math.sin(ang) * step;
      p.sprite.setPosition(p.x, p.y);
      p.sprite.rotation = ang;
    }
  }
}
