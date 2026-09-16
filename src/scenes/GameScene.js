// 이 값들은 전부 실제 화면에 타워/경로를 여러 조합으로 배치해보고 스크린샷으로
// 직접 비교해서 잡은 값이다 (추측 아님):
//
// - towerSpacing: "108x108 텍스처 = 실제 크기"로 착각하고 98까지 올렸었는데,
//   타워의 실제 시각적 몸체(8각형 테두리)는 텍스처 안에서 반지름 30~33px
//   정도만 차지해서(TextureForge의 baseR 참고) 98은 오히려 너무 넓게 떨어져
//   보였다. 62로 한 번 내렸는데, 그러면 경로가 파인 좁은 홈(예: (260,150)-
//   (260,320)-(500,320)-(500,150) 구간, 건설 가능 폭 104px)에서 플레이어가
//   가운데에 먼저 하나를 지으면 양옆에 추가로 지을 공간이 안 나오는 문제가
//   있었다(62짜리 간격 2개 = 124 > 104). 50으로 더 내려서 "가운데 하나 +
//   양옆 두 개"가 실제로 다 들어가는 걸 실측 확인 — 살짝 더 겹치지만
//   여전히 자연스러운 벌집 모양으로 보임.
// - pathMargin: 44였을 때 타워 몸체(반지름 ~31)가 경로의 굵은 테두리
//   (lineWidth 72 => 중심에서 36px)를 파고들어 겹쳐 보였다. 직선 구간과
//   코너(꺾이는 지점) 양쪽에서 여러 거리(44~88)를 실측 비교해서, 68 정도면
//   코너에서도 안전하게 경로와 떨어져 보이는 걸 확인.
// - maxPathDistance: pathMargin이 커진 만큼 건설 가능한 띠(band)가 너무
//   얇아지지 않도록 DECK_RADIUS(150) 안쪽에서 여유 있게 재조정.
// - edgeMargin: 화면 가장자리(경로 시작/끝 근처)에 타워가 바짝 붙어 답답하게
//   배치되는 것을 막기 위한 여백.
const PLACEMENT = { pathMargin: 68, maxPathDistance: 135, towerSpacing: 50, playTop: 64, playBottom: 650, edgeMargin: 34 };
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
    return y > PLACEMENT.playTop && y < PLACEMENT.playBottom
      && x > PLACEMENT.edgeMargin && x < 1280 - PLACEMENT.edgeMargin;
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
    // 보스 웨이브가 아니면(또는 중간보스를 넘긴 뒤) 평상시 브금으로 복귀 —
    // 중간보스 브금 모드에 계속 머물러 있지 않도록 매 일반 웨이브마다 확인한다.
    if (!wave.boss) Sfx.setMusicMode("game");
    if (wave.boss) {
      Sfx.bossAlert();
      this.ui.flashAlert(); // 중간보스·최종보스 동일하게 화면 빨간 사이렌 펄스
      const isFinal = waveNum === WAVES.length;
      // 평상시 → 중간보스 → 최종보스로 브금이 3단 계단식으로 상승한다.
      Sfx.setMusicMode(isFinal ? "boss" : "midboss");
      this.time.delayedCall(400, () => this.ui.showBanner(isFinal ? "☠ 최종보스 출현 ☠" : "⚠ 중간보스 출현 ⚠", PALETTE.danger, true));
      // 보스를 놓쳤을 때의 페널티를 미리 안내 — 갑자기 생명이 확 깎이거나
      // 게임이 끝나면 당황스러우니, 웨이브 시작 시점에 미리 경고해준다.
      this.time.delayedCall(1800, () => this.ui.showBanner(
        isFinal ? "최종보스가 기지에 도달하면 즉시 패배합니다!" : "중간보스를 놓치면 생명을 크게 잃습니다!",
        PALETTE.danger, false, 3000,
      ));
      // 보스 웨이브 카메라 확대 연출은 제거함(요청) — 확대 후 복귀가 버그였던 적도
      // 있었고, 아예 없는 게 낫겠다는 판단.
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
    // 일반 유닛이 새는 것과, 그렇게 열심히 키운 보스가 뚫리는 건 무게감이
    // 달라야 한다 — 지금까진 전부 똑같이 생명 1개만 깎여서 보스를 놓쳐도
    // 아무렇지 않았다. 중간보스는 크게, 최종보스는 그 즉시 패배로 처리한다
    // (생명을 정확히 0으로 만들어서 기존 "생명 0 = 패배" 로직을 그대로 탄다).
    let dmg = 1;
    if (enemy.type === "boss") dmg = 4;
    else if (enemy.type === "finalboss") dmg = this.life;
    this.life = Math.max(0, this.life - dmg);
    Sfx.lifeLost();
    const gx = this.path.points[this.path.points.length - 1].x;
    const gy = this.path.points[this.path.points.length - 1].y;
    const heavy = dmg > 1;
    Fx.ring(gx, gy, PALETTE.danger, heavy ? 90 : 60, heavy ? 420 : 300);
    // 보스급 페널티는 순식간에 사라지면 뭐가 깎였는지 읽기도 전에 없어져서,
    // 훨씬 오래(그리고 천천히 떠오르게) 남겨둔다.
    Fx.floatText(gx, gy - 40, `-${dmg}`, "#ff3b5c", {
      size: heavy ? "26px" : "15px",
      duration: heavy ? 2600 : 700,
      rise: heavy ? 70 : 34,
    });
    this.cameras.main.shake(heavy ? 260 : 140, heavy ? 0.008 : 0.004);
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

  // 일시정지 — GameScene뿐 아니라 UIScene도 같이 멈춰야(pause) 화면이 멈춰있는
  // 동안 타워 상점/업그레이드 패널 등을 실수로 계속 조작할 수 없다. 실제
  // 선택지(이어하기/타이틀로 나가기)는 항상 살아있는 별도 씬(PauseScene)에서 처리한다
  // — 게임오버 화면과 동일한 패턴.
  pauseGame() {
    if (this.over) return;
    this.scene.pause();
    this.scene.pause("UIScene");
    this.scene.launch("PauseScene");
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
