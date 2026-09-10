// HUD 전용 씬 — GameScene과 병렬 실행, 별도 카메라라서 흔들림/줌 이펙트의 영향을 받지 않는다.
//
// 클릭 판정: Phaser의 오브젝트별 setInteractive()가 씬이 여러 개 겹친 상황에서
// 간헐적으로 씹히는 현상이 있어(원인 불명, 재현은 확실함), GameScene의 타워 클릭과
// 동일하게 "전역 pointerdown 하나 + 사각형 판정 리스트" 방식으로 모든 버튼을 처리한다.

class UIScene extends Phaser.Scene {
  constructor() { super("UIScene"); }

  init(data) { this.game_ = data.gameScene; }

  create() {
    this.hotspots = [];
    this._hovered = null;
    this.buttons = [];
    this._buildTopBar();
    this._buildBottomBar();
    this._buildUpgradePanel();
    this._buildTooltip();
    this._lastGold = null;
    this._lastLife = null;
    this._lastWave = null;

    this.input.on("pointerdown", (p) => this._onDown(p));
    this.input.on("pointermove", (p) => this._onMove(p));
  }

  // ---------------- 클릭/호버 라우팅 ----------------
  addHotspot(spec) { this.hotspots.push(spec); return spec; }

  _contains(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

  _onDown(p) {
    for (const h of this.hotspots) {
      if (!h.active || !h.active()) continue;
      if (this._contains(p, h.getRect())) { h.onDown && h.onDown(); return; }
    }
  }

  _onMove(p) {
    let hit = null;
    for (const h of this.hotspots) {
      if (!h.active || !h.active()) continue;
      if (this._contains(p, h.getRect())) { hit = h; break; }
    }
    if (hit !== this._hovered) {
      if (this._hovered && this._hovered.onOut) this._hovered.onOut();
      if (hit && hit.onOver) hit.onOver();
      this._hovered = hit;
    }
    if (hit && hit.tooltip) this._showTooltip(hit.tooltip(), hit.getRect());
    else this._hideTooltip();
  }

  // ---------------- 상단 바 ----------------
  _buildTopBar() {
    const w = 1280, h = 64;
    this.add.rectangle(0, 0, w, h, PALETTE.panel, 0.94).setOrigin(0, 0).setDepth(90);
    this.add.rectangle(0, h - 2, w, 2, PALETTE.goldTrim, 0.5).setOrigin(0, 0).setDepth(90);

    this.add.image(26, 32, "ic_coin").setDepth(91);
    this.goldText = this.add.text(44, 32, "0", this._numStyle()).setOrigin(0, 0.5).setDepth(91);

    this.add.image(178, 32, "ic_life").setDepth(91);
    this.lifeText = this.add.text(196, 32, "0", this._numStyle()).setOrigin(0, 0.5).setDepth(91);

    this.waveText = this.add.text(640, 20, "대기 중", {
      fontFamily: "Segoe UI, sans-serif", fontSize: "17px", color: hexToCss(PALETTE.textPrimary), fontStyle: "bold",
    }).setOrigin(0.5, 0.5).setDepth(91);

    this.waveBarBg = this.add.rectangle(640, 42, 260, 6, 0x000000, 0.4).setDepth(91);
    this.waveBarFg = this.add.rectangle(640 - 130, 42, 0, 6, PALETTE.goldTrim, 1).setOrigin(0, 0.5).setDepth(91);

    // 속도 토글
    const speedX = 1216, speedY = 32, speedW = 80, speedH = 44;
    const speedC = this.add.container(speedX, speedY).setDepth(91);
    const speedBg = this.add.rectangle(0, 0, 70, 38, PALETTE.panelLight, 1).setStrokeStyle(1, PALETTE.hullEdge, 0.6);
    this.speedLabel = this.add.text(0, 0, "1x", { fontFamily: "Segoe UI, sans-serif", fontSize: "16px", color: hexToCss(PALETTE.textPrimary), fontStyle: "bold" }).setOrigin(0.5);
    speedC.add([speedBg, this.speedLabel]);

    this.addHotspot({
      getRect: () => ({ x: speedX - speedW / 2, y: speedY - speedH / 2, w: speedW, h: speedH }),
      active: () => true,
      onDown: () => {
        Sfx.uiClick();
        const m = this.game_.toggleSpeed();
        this.speedLabel.setText(m + "x");
        speedBg.setStrokeStyle(1, m === 2 ? PALETTE.good : PALETTE.hullEdge, 0.9);
      },
      onOver: () => speedBg.setFillStyle(lighten(PALETTE.panelLight, 12)),
      onOut: () => speedBg.setFillStyle(PALETTE.panelLight),
      tooltip: () => "1배속 / 2배속 전환",
    });
  }

  _numStyle() {
    return { fontFamily: "Segoe UI, sans-serif", fontSize: "19px", color: hexToCss(PALETTE.textPrimary), fontStyle: "bold" };
  }

  // ---------------- 하단 타워 바 ----------------
  _buildBottomBar() {
    const y0 = 650, h = 70, w = 1280;
    this.add.rectangle(0, y0, w, h, PALETTE.panel, 0.94).setOrigin(0, 0).setDepth(90);
    this.add.rectangle(0, y0, w, 2, PALETTE.goldTrim, 0.6).setOrigin(0, 0).setDepth(90);

    const n = TOWER_ORDER.length;
    const btnW = 196, btnH = 58, gap = 8;
    const totalW = n * btnW + (n - 1) * gap;
    let x = (w - totalW) / 2;
    const cy = y0 + h / 2;

    TOWER_ORDER.forEach((id, i) => {
      const def = TOWERS[id];
      const accent = PALETTE[def.color];
      const cx = x + btnW / 2;
      const c = this.add.container(cx, cy).setDepth(91);
      const bg = this.add.rectangle(0, 0, btnW - 6, btnH, PALETTE.panelLight, 1).setStrokeStyle(2, accent, 0.55);
      const base = this.add.image(-btnW / 2 + 30, 0, `tw_${id}_base`).setScale(0.62);
      const turret = this.add.image(-btnW / 2 + 30, 0, `tw_${id}_turret`).setScale(0.62).setRotation(-Math.PI / 4);
      const name = this.add.text(-btnW / 2 + 56, -12, def.name, { fontFamily: "Segoe UI, sans-serif", fontSize: "13px", color: hexToCss(PALETTE.textPrimary), fontStyle: "bold" }).setOrigin(0, 0.5);
      const cost = this.add.text(-btnW / 2 + 56, 8, `${def.cost} G`, { fontFamily: "Segoe UI, sans-serif", fontSize: "12px", color: hexToCss(PALETTE.goldTrim) }).setOrigin(0, 0.5);
      const key = this.add.text(-btnW / 2 + 6, -btnH / 2 + 12, String(i + 1), {
        fontFamily: "Segoe UI, sans-serif", fontSize: "11px", color: hexToCss(PALETTE.textMuted),
      }).setOrigin(0, 0.5);

      c.add([bg, base, turret, name, cost, key]);

      const entry = { container: c, bg, def, accent };
      this.buttons.push(entry);

      this.addHotspot({
        getRect: () => ({ x: cx - btnW / 2, y: cy - btnH / 2, w: btnW - 6, h: btnH }),
        active: () => true,
        onDown: () => this.selectBuildButton(i),
        onOver: () => { if (this.selectedIndex !== i) bg.setFillStyle(lighten(PALETTE.panelLight, 10)); },
        onOut: () => { if (this.selectedIndex !== i) bg.setFillStyle(PALETTE.panelLight); },
        tooltip: () => `${def.name}\n${def.desc}`,
      });

      x += btnW + gap;
    });
  }

  clearBuildSelection() {
    this.selectedIndex = -1;
    this.buttons.forEach((b) => { b.bg.setStrokeStyle(2, b.accent, 0.55); b.bg.setFillStyle(PALETTE.panelLight); });
  }

  selectBuildButton(i) {
    const entry = this.buttons[i];
    if (!entry) return;
    // 이미 선택된 타워를 다시 클릭/같은 숫자키를 또 누르면 선택을 취소한다
    // (커서가 빈 상태로 돌아가야 하는데 재선택만 되던 문제)
    if (this.selectedIndex === i) {
      Sfx.uiClick();
      this.game_.cancelBuild();
      return;
    }
    Sfx.uiClick();
    this.selectedIndex = i;
    this.game_.setBuildType(entry.def.id);
    this.buttons.forEach((b, j) => b.bg.setStrokeStyle(2, b.accent, j === i ? 1 : 0.55));
    this.buttons.forEach((b, j) => b.bg.setFillStyle(j === i ? lighten(PALETTE.panelLight, 14) : PALETTE.panelLight));
  }

  // ---------------- 업그레이드 패널 ----------------
  _buildUpgradePanel() {
    this.panelW = 220; this.panelH = 224;
    this.panelX = 1280 - 232; this.panelY = 78;
    this.panel = this.add.container(this.panelX, this.panelY).setDepth(95).setVisible(false);
    const bg = this.add.rectangle(0, 0, this.panelW, this.panelH, PALETTE.panel, 0.97).setOrigin(0, 0).setStrokeStyle(2, PALETTE.goldTrim, 0.6);
    this.panelTitle = this.add.text(12, 10, "", { fontFamily: "Segoe UI, sans-serif", fontSize: "16px", color: hexToCss(PALETTE.textPrimary), fontStyle: "bold" });
    this.panelLevel = this.add.text(12, 32, "", { fontFamily: "Segoe UI, sans-serif", fontSize: "12px", color: hexToCss(PALETTE.textMuted) });
    this.panelStats = this.add.text(12, 54, "", { fontFamily: "Segoe UI, sans-serif", fontSize: "12px", color: hexToCss(0xd8e4f5), lineSpacing: 5 });

    this.upgradeBg = this.add.rectangle(108, 148, 192, 32, PALETTE.good, 0.85).setStrokeStyle(1, 0xffffff, 0.4);
    this.upgradeLabel = this.add.text(108, 148, "", { fontFamily: "Segoe UI, sans-serif", fontSize: "13px", color: "#08210f", fontStyle: "bold" }).setOrigin(0.5);

    this.sellBg = this.add.rectangle(108, 190, 192, 32, PALETTE.danger, 0.85).setStrokeStyle(1, 0xffffff, 0.35);
    this.sellLabel = this.add.text(108, 190, "", { fontFamily: "Segoe UI, sans-serif", fontSize: "13px", color: "#2a0e0e", fontStyle: "bold" }).setOrigin(0.5);

    const closeBtn = this.add.text(198, 10, "✕", { fontFamily: "Segoe UI, sans-serif", fontSize: "16px", color: hexToCss(PALETTE.textMuted) }).setOrigin(0.5);

    this.panel.add([bg, this.panelTitle, this.panelLevel, this.panelStats, this.upgradeBg, this.upgradeLabel, this.sellBg, this.sellLabel, closeBtn]);

    const panelActive = () => this.panel.visible;
    this.addHotspot({
      getRect: () => ({ x: this.panel.x + 12, y: this.panel.y + 132, w: 192, h: 32 }),
      active: panelActive,
      onDown: () => this._onUpgradeClick(),
    });
    this.addHotspot({
      getRect: () => ({ x: this.panel.x + 12, y: this.panel.y + 174, w: 192, h: 32 }),
      active: panelActive,
      onDown: () => this._onSellClick(),
      onOver: () => this.sellBg.setFillStyle(lighten(PALETTE.danger, 20), 0.9),
      onOut: () => this.sellBg.setFillStyle(PALETTE.danger, 0.85),
    });
    this.addHotspot({
      getRect: () => ({ x: this.panel.x + 184, y: this.panel.y - 4, w: 28, h: 28 }),
      active: panelActive,
      onDown: () => { Sfx.uiClick(); this.game_.deselectTower(); },
      onOver: () => closeBtn.setColor(hexToCss(PALETTE.textPrimary)),
      onOut: () => closeBtn.setColor(hexToCss(PALETTE.textMuted)),
    });
  }

  _onUpgradeClick() {
    const t = this.game_.selectedTower;
    if (!t) return;
    const cost = t.upgradeCost();
    if (cost === null) return;
    if (this.game_.gold < cost) { Sfx.error(); return; }
    this.game_.gold -= cost;
    t.upgrade();
    this._refreshPanel();
  }

  _onSellClick() {
    const t = this.game_.selectedTower;
    if (!t) return;
    Sfx.uiClick();
    this.game_.sellTower(t);
    this.panel.setVisible(false);
  }

  _refreshPanel() {
    const t = this.game_.selectedTower;
    if (!t) { this.panel.setVisible(false); return; }
    this.panel.setVisible(true);
    this.panel.setPosition(Phaser.Math.Clamp(t.x + 40, 20, 1280 - 252), Phaser.Math.Clamp(t.y - 100, 70, 460));
    this.panelTitle.setText(`${t.def.name}`);
    this.panelLevel.setText(`Lv.${t.level} / 3  —  ${t.def.short}`);
    const s = t.stats;
    const lines = [`사거리 ${Math.round(s.range)}`];
    if (t.def.damage || t.def.behavior === "single" || t.def.behavior === "pierce" || t.def.behavior === "splash" || t.def.behavior === "poison") lines.push(`피해 ${Math.round(s.damage)}`);
    if (t.def.behavior === "pierce") lines.push(`관통 ${s.pierceCount}명`);
    if (t.def.behavior === "splash") lines.push(`폭발 반경 ${Math.round(s.splashRadius)}`);
    if (t.def.behavior === "slow") lines.push(`감속 ${Math.round(s.slowPct)}%`);
    if (t.def.behavior === "poison") lines.push(`독 ${s.poisonDps.toFixed(1)}/s x${s.poisonMaxStacks}`);
    if (t.def.behavior === "stun") lines.push(`스턴 ${s.stunDuration.toFixed(1)}s`);
    this.panelStats.setText(lines.join("\n"));

    const cost = t.upgradeCost();
    if (cost === null) {
      this.upgradeLabel.setText("MAX 레벨");
      this.upgradeBg.setFillStyle(PALETTE.hullMid, 0.9);
    } else {
      const afford = this.game_.gold >= cost;
      this.upgradeLabel.setText(`업그레이드 (${cost} G)`);
      this.upgradeBg.setFillStyle(afford ? PALETTE.good : PALETTE.hullMid, afford ? 0.85 : 0.7);
    }
    this.sellLabel.setText(`판매 (+${t.sellValue()} G)`);
  }

  // ---------------- 툴팁 ----------------
  _buildTooltip() {
    this.tooltip = this.add.container(0, 0).setDepth(120).setVisible(false);
    this.tooltipBg = this.add.rectangle(0, 0, 10, 10, 0x05070c, 0.96).setOrigin(0.5, 1).setStrokeStyle(1, PALETTE.goldTrim, 0.7);
    this.tooltipText = this.add.text(0, 0, "", {
      fontFamily: "Segoe UI, sans-serif", fontSize: "12px", color: hexToCss(PALETTE.textPrimary), align: "center", lineSpacing: 4,
    }).setOrigin(0.5, 1);
    this.tooltip.add([this.tooltipBg, this.tooltipText]);
  }

  _showTooltip(text, anchorRect) {
    this.tooltipText.setText(text);
    const w = this.tooltipText.width + 20, h = this.tooltipText.height + 14;
    this.tooltipBg.setSize(w, h);
    const x = Phaser.Math.Clamp(anchorRect.x + anchorRect.w / 2, w / 2 + 6, 1280 - w / 2 - 6);
    const below = anchorRect.y < 100;
    if (below) {
      this.tooltipBg.setOrigin(0.5, 0);
      this.tooltipText.setOrigin(0.5, 0);
      this.tooltip.setPosition(x, anchorRect.y + anchorRect.h + 8);
    } else {
      this.tooltipBg.setOrigin(0.5, 1);
      this.tooltipText.setOrigin(0.5, 1);
      this.tooltip.setPosition(x, anchorRect.y - 8);
    }
    this.tooltip.setVisible(true);
  }

  _hideTooltip() { this.tooltip.setVisible(false); }

  // ---------------- 배너 ----------------
  showBanner(text, color, big = false) {
    const t = this.add.text(640, big ? 120 : 96, text, {
      fontFamily: "Segoe UI, sans-serif", fontSize: big ? "34px" : "24px", color: hexToCss(color),
      fontStyle: "bold", stroke: "#04070c", strokeThickness: 5,
    }).setOrigin(0.5).setDepth(98).setAlpha(0);
    this.tweens.add({
      targets: t, alpha: 1, y: (big ? 120 : 96) + 10, duration: 260, ease: "Cubic.Out",
      onComplete: () => {
        this.tweens.add({ targets: t, alpha: 0, delay: big ? 1400 : 1000, duration: 400, onComplete: () => t.destroy() });
      },
    });
  }

  update() {
    const g = this.game_;
    if (g.gold !== this._lastGold) { this.goldText.setText(String(g.gold)); this._lastGold = g.gold; }
    if (g.life !== this._lastLife) {
      this.lifeText.setText(String(Math.max(0, g.life)));
      this.lifeText.setColor(g.life <= 3 ? "#ff5d5d" : hexToCss(PALETTE.textPrimary));
      this._lastLife = g.life;
    }
    const wm = g.waveManager;
    if (wm) {
      const waveLabel = wm.waveIndex === 0 ? "대기 중" : `웨이브 ${Math.min(wm.waveIndex, WAVES.length)} / ${WAVES.length}`;
      if (waveLabel !== this._lastWave) { this.waveText.setText(waveLabel); this._lastWave = waveLabel; }
      const ratio = Phaser.Math.Clamp(wm.waveIndex / WAVES.length, 0, 1);
      this.waveBarFg.width = 260 * ratio;
    }
    if (g.selectedTower) this._refreshPanel();
    else this.panel.setVisible(false);
  }
}
