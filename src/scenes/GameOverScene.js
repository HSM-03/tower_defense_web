class GameOverScene extends Phaser.Scene {
  constructor() { super("GameOverScene"); }

  init(data) { this.data_ = data; }

  create() {
    const w = this.scale.width, h = this.scale.height;
    const { win, waveReached, totalWaves, towerCount } = this.data_;

    this.add.rectangle(0, 0, w, h, 0x000000, 0.72).setOrigin(0, 0);

    const panel = this.add.container(w / 2, h / 2);
    this.panelRef = panel;
    const bg = this.add.rectangle(0, 0, 460, 320, PALETTE.panel, 0.97).setStrokeStyle(2, win ? PALETTE.good : PALETTE.danger, 0.8);
    panel.add(bg);

    const title = this.add.text(0, -118, win ? "방위 성공" : "기지 함락", {
      fontFamily: "Segoe UI, sans-serif", fontSize: "36px", fontStyle: "bold",
      color: win ? "#4dffa0" : "#ff4d5e",
    }).setOrigin(0.5);
    title.setShadow(0, 0, win ? "#4dffa0" : "#ff4d5e", 18, true, true);
    panel.add(title);

    const statLines = [
      `도달 웨이브: ${Math.min(waveReached, totalWaves)} / ${totalWaves}`,
      `건설한 타워: ${towerCount}`,
    ];
    const stats = this.add.text(0, -46, statLines.join("\n"), {
      fontFamily: "Segoe UI, sans-serif", fontSize: "17px", color: hexToCss(0xe8ddc4), align: "center", lineSpacing: 10,
    }).setOrigin(0.5);
    panel.add(stats);

    const retryBtn = this._makeButton(0, 40, "다시 시작", PALETTE.good, () => {
      Sfx.uiClick();
      this.scene.stop("UIScene");
      this.scene.stop("GameScene");
      this.scene.stop("GameOverScene");
      this.scene.start("GameScene");
    });
    const titleBtn = this._makeButton(0, 104, "타이틀로", PALETTE.hullLight, () => {
      Sfx.uiClick();
      this.scene.stop("UIScene");
      this.scene.stop("GameScene");
      this.scene.stop("GameOverScene");
      this.scene.start("TitleScene");
    });
    panel.add([retryBtn, titleBtn]);

    panel.setScale(0.85);
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 260, ease: "Back.Out" });
  }

  _makeButton(x, y, text, color, onClick) {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 260, 46, color, 0.85).setStrokeStyle(1, 0xffffff, 0.35);
    const label = this.add.text(0, 0, text, { fontFamily: "Segoe UI, sans-serif", fontSize: "17px", color: "#04140a", fontStyle: "bold" }).setOrigin(0.5);
    c.add([bg, label]);

    // panel(부모 컨테이너)이 움직이므로 매 프레임 현재 위치를 계산해 판정한다.
    const getRect = () => {
      const wx = this.panelRef.x + x, wy = this.panelRef.y + y;
      return { x: wx - 130, y: wy - 23, w: 260, h: 46 };
    };
    this.input.on("pointermove", (p) => {
      const r = getRect();
      const over = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
      bg.setFillStyle(over ? lighten(color, 20) : color, over ? 1 : 0.85);
    });
    this.input.on("pointerdown", (p) => {
      const r = getRect();
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) onClick();
    });
    return c;
  }
}
