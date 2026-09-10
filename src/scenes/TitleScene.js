class TitleScene extends Phaser.Scene {
  constructor() { super("TitleScene"); }

  create() {
    const w = this.scale.width, h = this.scale.height;
    Sfx.setMusicMode("title"); // 오디오가 이미 풀려있는 상태로 타이틀에 돌아온 경우 트랙 전환

    // ---- 배경: 생성된 SF 정거장 아트워크 ----
    this.add.image(0, 0, "introBg").setOrigin(0, 0).setDisplaySize(w, h).setDepth(0);

    // 텍스트 가독성을 위한 비네트(위/아래 어둡게, 중앙은 그림이 보이도록)
    const grad = this.add.graphics().setDepth(1);
    grad.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.75, 0.75, 0, 0);
    grad.fillRect(0, 0, w, 260);
    const gradBottom = this.add.graphics().setDepth(1);
    gradBottom.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.8, 0.8);
    gradBottom.fillRect(0, h - 260, w, 260);

    // ---- 적 유닛 대형 (하단, 뒤판+링으로 뚜렷하게 보이도록) ----
    const decoIds = ["tank", "fast", "evasive", "normal", "boss"];
    decoIds.forEach((id, i) => {
      const x = 210 + i * 220;
      const y = 664 + (i % 2 === 0 ? -8 : 8);
      const scale = id === "boss" ? 0.62 : 0.95;
      const accent = PALETTE[ENEMIES[id].color];

      const plate = this.add.circle(x, y, 34 * scale, 0x000000, 0.45).setDepth(1.95);
      const ring = this.add.circle(x, y, 32 * scale, 0x000000, 0).setStrokeStyle(2, accent, 0.85).setDepth(2.05);
      const img = this.add.image(x, y, `en_${id}`).setAlpha(1).setScale(scale).setDepth(2);

      [plate, ring, img].forEach((o) => {
        this.tweens.add({ targets: o, y: o.y - 10, duration: 1700 + i * 160, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      });
    });

    // ---- 타이틀 로고 ----
    const titleY = 92;
    const titleGlow = this.add.text(w / 2, titleY, "최후의 기지", {
      fontFamily: "Segoe UI, sans-serif", fontSize: "58px", fontStyle: "bold", color: hexToCss(PALETTE.pathGlow),
    }).setOrigin(0.5).setDepth(2.9).setAlpha(0.5).setScale(1.04);
    const title = this.add.text(w / 2, titleY, "최후의 기지", {
      fontFamily: "Segoe UI, sans-serif", fontSize: "56px", fontStyle: "bold", color: hexToCss(PALETTE.textPrimary),
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(3);
    title.setShadow(0, 3, "#000000", 10, true, true);
    title.setShadow(0, 0, hexToCss(PALETTE.pathGlow), 22, true, true);
    this.tweens.add({ targets: titleGlow, alpha: { from: 0.25, to: 0.55 }, scale: { from: 1.02, to: 1.07 }, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    const scan = this.add.rectangle(w / 2 - 260, titleY, 6, 62, PALETTE.pathGlow, 0.5).setDepth(3.1).setBlendMode("ADD");
    this.tweens.add({ targets: scan, x: w / 2 + 260, duration: 2600, repeat: -1, ease: "Sine.InOut", delay: 600 });

    this.add.text(w / 2, 142, "T H E   L A S T   S T A T I O N", {
      fontFamily: "Segoe UI, sans-serif", fontSize: "14px", color: hexToCss(PALETTE.pathGlow), letterSpacing: 5,
    }).setOrigin(0.5).setDepth(3).setShadow(0, 2, "#000000", 6, true, true);

    // ---- 안내 패널 ----
    const panelY = 232;
    const panel = this.add.rectangle(w / 2, panelY + 62, 580, 172, PALETTE.panel, 0.86).setStrokeStyle(2, PALETTE.goldTrim, 0.55).setDepth(3);
    const corner = this.add.graphics().setDepth(3.05);
    corner.lineStyle(2, PALETTE.goldTrim, 0.8);
    [[w / 2 - 290, panelY - 24], [w / 2 + 290, panelY - 24], [w / 2 - 290, panelY + 148], [w / 2 + 290, panelY + 148]].forEach(([cx, cy], i) => {
      const sx = i % 2 === 0 ? 1 : -1, sy = i < 2 ? 1 : -1;
      corner.lineBetween(cx, cy, cx + 14 * sx, cy);
      corner.lineBetween(cx, cy, cx, cy + 14 * sy);
    });
    const lines = [
      "▸ 마우스로 타워를 배치해 통로를 방어하세요",
      "▸ 숫자키 1~6 으로 타워를 빠르게 선택할 수 있습니다",
      "▸ 설치된 타워를 클릭하면 업그레이드 · 판매 패널이 열립니다",
      "▸ 생명이 0이 되면 게임 종료 — 12웨이브를 모두 막아내세요",
    ];
    this.add.text(w / 2, panelY + 62, lines.join("\n"), {
      fontFamily: "Segoe UI, sans-serif", fontSize: "15px", color: hexToCss(0xcfe0f5), align: "left", lineSpacing: 12,
    }).setOrigin(0.5).setDepth(3);

    // ---- 시작 버튼 ----
    const btn = this.add.container(w / 2, 562).setDepth(3);
    const glow = this.add.rectangle(0, 0, 240, 68, PALETTE.good, 0.35);
    const bg = this.add.rectangle(0, 0, 220, 56, PALETTE.good, 0.92).setStrokeStyle(2, 0xffffff, 0.5);
    const label = this.add.text(0, 0, "시작하기", { fontFamily: "Segoe UI, sans-serif", fontSize: "22px", color: "#04210f", fontStyle: "bold" }).setOrigin(0.5);
    btn.add([glow, bg, label]);
    this.tweens.add({ targets: glow, scale: { from: 0.9, to: 1.14 }, alpha: { from: 0.4, to: 0 }, duration: 1000, repeat: -1, ease: "Sine.Out" });

    const btnRect = { x: w / 2 - 120, y: 562 - 34, w: 240, h: 68 };

    // ---- 정보(도감) 버튼 — 시작하기 버튼 바로 위, 눈에 잘 띄게 배치 ----
    const infoRect = { x: w / 2 - 130, y: 468, w: 260, h: 44 };
    const infoBtn = this.add.container(infoRect.x + infoRect.w / 2, infoRect.y + infoRect.h / 2).setDepth(5);
    const infoGlow = this.add.rectangle(0, 0, infoRect.w + 16, infoRect.h + 14, PALETTE.goldTrim, 0.28);
    const infoBg = this.add.rectangle(0, 0, infoRect.w, infoRect.h, PALETTE.panel, 0.92).setStrokeStyle(2, PALETTE.goldTrim, 0.9);
    const infoLabel = this.add.text(0, 0, "ℹ  타워 · 유닛 정보", { fontFamily: "Segoe UI, sans-serif", fontSize: "15px", color: hexToCss(PALETTE.textPrimary), fontStyle: "bold" }).setOrigin(0.5);
    infoBtn.add([infoGlow, infoBg, infoLabel]);
    this.tweens.add({ targets: infoGlow, alpha: { from: 0.16, to: 0.4 }, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    const infoModal = this._buildInfoModal(w, h);
    const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

    // 시작 버튼 / 정보 버튼 / 정보 모달 닫기를 전부 하나의 핸들러에서 순서대로
    // 처리한다 (모달이 열려 있을 때 그 뒤에 깔린 시작 버튼까지 같이 눌리는
    // 것을 막기 위해 — 모달이 열려있으면 그 클릭은 "닫기"로만 소비하고 끝냄).
    this.input.on("pointermove", (p) => {
      if (infoModal.visible) return;
      const over = inRect(p, btnRect);
      bg.setFillStyle(over ? lighten(PALETTE.good, 24) : PALETTE.good, over ? 1 : 0.92);
      const overInfo = inRect(p, infoRect);
      infoBg.setFillStyle(overInfo ? lighten(PALETTE.panel, 20) : PALETTE.panel, 0.85);
    });
    this.input.on("pointerdown", (p) => {
      // 타이틀 화면 아무 곳이나 클릭해도 오디오가 활성화되고 배경음악이 바로 시작된다.
      Sfx.unlock();

      if (infoModal.visible) { infoModal.setVisible(false); return; }
      if (inRect(p, infoRect)) { Sfx.uiClick(); infoModal.setVisible(true); return; }
      if (!inRect(p, btnRect)) return;

      Sfx.uiClick();
      this.cameras.main.fadeOut(280, 4, 6, 10);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("GameScene"));
    });

    this.cameras.main.fadeIn(400, 4, 6, 10);
  }

  // 타워 6종 + 적 5종의 이름/역할/설명을 한눈에 보여주는 정보 패널
  _buildInfoModal(w, h) {
    const modal = this.add.container(0, 0).setDepth(20).setVisible(false);
    const dim = this.add.rectangle(0, 0, w, h, 0x000000, 0.82).setOrigin(0, 0);
    modal.add(dim);

    const panelW = 1080, panelH = 600;
    const px = (w - panelW) / 2, py = (h - panelH) / 2;
    const panel = this.add.rectangle(px, py, panelW, panelH, PALETTE.panel, 0.98).setOrigin(0, 0).setStrokeStyle(2, PALETTE.goldTrim, 0.7);
    modal.add(panel);

    modal.add(this.add.text(w / 2, py + 26, "타워 & 유닛 정보", {
      fontFamily: "Segoe UI, sans-serif", fontSize: "22px", fontStyle: "bold", color: hexToCss(PALETTE.textPrimary),
    }).setOrigin(0.5));
    modal.add(this.add.text(w / 2, py + 54, "화면을 클릭하면 닫힙니다", {
      fontFamily: "Segoe UI, sans-serif", fontSize: "12px", color: hexToCss(PALETTE.textDim),
    }).setOrigin(0.5));

    // 왼쪽: 타워 6종
    const colTowerX = px + 24;
    modal.add(this.add.text(colTowerX, py + 84, "▸ 타워", { fontFamily: "Segoe UI, sans-serif", fontSize: "15px", fontStyle: "bold", color: hexToCss(PALETTE.goldTrim) }));
    TOWER_ORDER.forEach((id, i) => {
      const def = TOWERS[id];
      const accent = PALETTE[def.color];
      const rowY = py + 116 + i * 78;
      const base = this.add.image(colTowerX + 22, rowY + 20, `tw_${id}_base`).setScale(0.55);
      const turret = this.add.image(colTowerX + 22, rowY + 20, `tw_${id}_turret`).setScale(0.55).setRotation(-Math.PI / 4);
      const name = this.add.text(colTowerX + 54, rowY, `${def.name}  (${def.short})`, {
        fontFamily: "Segoe UI, sans-serif", fontSize: "14px", fontStyle: "bold", color: hexToCss(accent),
      });
      const desc = this.add.text(colTowerX + 54, rowY + 20, def.desc, {
        fontFamily: "Segoe UI, sans-serif", fontSize: "12px", color: hexToCss(0xcfe0f5), wordWrap: { width: 420 },
      });
      modal.add([base, turret, name, desc]);
    });

    // 오른쪽: 적 5종
    const colEnemyX = px + panelW / 2 + 40;
    modal.add(this.add.text(colEnemyX, py + 84, "▸ 적 유닛", { fontFamily: "Segoe UI, sans-serif", fontSize: "15px", fontStyle: "bold", color: hexToCss(PALETTE.goldTrim) }));
    ENEMY_ORDER.forEach((id, i) => {
      const def = ENEMIES[id];
      const accent = PALETTE[def.color];
      const rowY = py + 116 + i * 92;
      const icon = this.add.image(colEnemyX + 22, rowY + 20, `en_${id}`).setScale(def.isBoss ? 0.32 : 0.55);
      const name = this.add.text(colEnemyX + 54, rowY, def.name, {
        fontFamily: "Segoe UI, sans-serif", fontSize: "14px", fontStyle: "bold", color: hexToCss(accent),
      });
      const desc = this.add.text(colEnemyX + 54, rowY + 20, def.desc, {
        fontFamily: "Segoe UI, sans-serif", fontSize: "12px", color: hexToCss(0xcfe0f5), wordWrap: { width: 420 },
      });
      modal.add([icon, name, desc]);
    });

    return modal;
  }
}
