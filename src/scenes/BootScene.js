class BootScene extends Phaser.Scene {
  constructor() { super("BootScene"); }

  create() {
    const w = this.scale.width, h = this.scale.height;
    this.cameras.main.setBackgroundColor(hexToCss(PALETTE.bgDark));
    const label = this.add.text(w / 2, h / 2, "구성 중...", {
      fontFamily: "Segoe UI, sans-serif", fontSize: "18px", color: "#7f93a8",
    }).setOrigin(0.5);

    this._loadIntroBg(() => {
      // 텍스처 생성은 동기 처리라 빠르지만, 다음 프레임으로 한 틱 넘겨서
      // "구성 중" 텍스트가 최소 한 프레임은 그려지도록 한다.
      this.time.delayedCall(30, () => {
        TextureForge.build(this);
        label.destroy();
        this.scene.start("TitleScene");
      });
    });
  }

  // 타이틀 배경 이미지는 별도 파일 로드가 아니라 코드에 내장된 base64 데이터
  // URI(introBgData.js)로 읽어온다. index.html을 file://로 더블클릭해서 열면
  // 브라우저가 로컬 이미지 파일 로드를 막거나 예전 캐시를 섞어 쓰는 경우가
  // 있었는데, 데이터 URI는 네트워크/파일 접근이 아예 없어 그 문제가 생길 수
  // 없다. 실패해도(이론상 거의 불가능) 게임은 배경 없이 계속 진행된다.
  _loadIntroBg(done) {
    if (this.textures.exists("introBg")) { done(); return; }
    if (typeof INTRO_BG_DATA_URI === "undefined") { done(); return; }
    const img = new Image();
    let finished = false;
    const finish = () => { if (!finished) { finished = true; done(); } };
    img.onload = () => {
      try { this.textures.addImage("introBg", img); } catch (e) { /* 이미 있으면 무시 */ }
      finish();
    };
    img.onerror = finish;
    img.src = INTRO_BG_DATA_URI;
    this.time.delayedCall(2000, finish);
  }
}
