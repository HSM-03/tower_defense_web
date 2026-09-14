// 일시정지 화면 — GameOverScene과 동일한 패턴(전역 pointerdown + 사각형 판정
// 버튼)으로 만든다. GameScene/UIScene은 이미 pause()된 상태이고, 이 씬만
// 살아있는 상태로 선택지를 보여준다.
class PauseScene extends Phaser.Scene {
  constructor() { super("PauseScene"); }

  create() {
    const w = this.scale.width, h = this.scale.height;

    this.add.rectangle(0, 0, w, h, 0x000000, 0.72).setOrigin(0, 0);

    const panel = this.add.container(w / 2, h / 2);
    this.panelRef = panel;
    const bg = this.add.rectangle(0, 0, 420, 260, PALETTE.panel, 0.97).setStrokeStyle(2, PALETTE.goldTrim, 0.8);
    panel.add(bg);

    const title = this.add.text(0, -84, "일시정지", {
      fontFamily: "Segoe UI, sans-serif", fontSize: "30px", fontStyle: "bold", color: hexToCss(PALETTE.textPrimary),
    }).setOrigin(0.5);
    title.setShadow(0, 0, hexToCss(PALETTE.pathGlow), 14, true, true);
    panel.add(title);

    const resumeBtn = this._makeButton(0, 6, "이어하기", PALETTE.good, () => {
      Sfx.uiClick();
      this.scene.resume("GameScene");
      this.scene.resume("UIScene");
      this.scene.stop("PauseScene");
    });
    const titleBtn = this._makeButton(0, 70, "타이틀로 나가기", PALETTE.hullLight, () => {
      Sfx.uiClick();
      Sfx.setMusicMode("title"); // 최종보스 전투 브금 도중 나갈 수도 있으니 되돌려둠
      this.scene.stop("UIScene");
      this.scene.stop("GameScene");
      this.scene.stop("PauseScene");
      this.scene.start("TitleScene");
    });
    panel.add([resumeBtn, titleBtn]);

    panel.setScale(0.85);
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 220, ease: "Back.Out" });
  }

  _makeButton(x, y, text, color, onClick) {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 280, 46, color, 0.85).setStrokeStyle(1, 0xffffff, 0.35);
    const label = this.add.text(0, 0, text, { fontFamily: "Segoe UI, sans-serif", fontSize: "17px", color: "#04140a", fontStyle: "bold" }).setOrigin(0.5);
    c.add([bg, label]);

    const getRect = () => {
      const wx = this.panelRef.x + x, wy = this.panelRef.y + y;
      return { x: wx - 140, y: wy - 23, w: 280, h: 46 };
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
