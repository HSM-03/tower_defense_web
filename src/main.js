const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: "game-root",
  backgroundColor: "#070a10",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true, pixelArt: false, roundPixels: false },
  scene: [BootScene, TitleScene, GameScene, UIScene, GameOverScene],
};

window.addEventListener("load", () => {
  window.game = new Phaser.Game(config);

  // 테스트/캡처 환경에서 탭이 "숨김" 상태로 인식되면 Phaser가 배터리 절약을 위해
  // 자체적으로 루프를 정지시킨다. ?forceRender=1 일 때만 그 정지를 무시한다
  // (일반 플레이어에게는 영향 없음 — 기본 동작 그대로 유지).
  if (new URLSearchParams(location.search).has("forceRender")) {
    window.game.events.on(Phaser.Core.Events.HIDDEN, () => window.game.loop.wake());
    window.game.events.on(Phaser.Core.Events.BLUR, () => window.game.loop.wake());
    setInterval(() => window.game.loop.wake(), 200);
  }
});
