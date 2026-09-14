// ============================================================
// 밸런스 데이터 — 수치는 전부 여기 한 곳에서만 관리한다.
// (나중에 실제 플레이 테스트로 다시 조정할 예정, 구조만 잘 잡아둠)
// ============================================================

const ECONOMY = {
  // 초반(1~4웨이브)이 타워 2~3개만으로 생명 손실 없이 너무 쉽게 뚫린다는
  // 실측 결과가 있어서, 시작 자금을 살짝 줄여 초반부터 선택에 신중해지게 함.
  startingGold: 200,
  startingLife: 12,
  waveBreak: 4.0, // 웨이브 사이 대기시간(초)
};

// 업그레이드 레벨(1~3)별 공통 배율
const UPGRADE = {
  statMult: [1, 1.45, 2.05],       // 데미지/슬로우%/마비시간/독 초당피해량
  rangeMult: [1, 1.12, 1.25],
  fireRateMult: [1, 1.15, 1.3],
  costMult: [0, 1.0, 1.9],         // 업그레이드 비용 = tower.cost * costMult[level]
};

const TOWERS = {
  basic: {
    id: "basic", name: "펄스 캐논", short: "단일 고화력",
    cost: 55, category: "physical", behavior: "single",
    range: 175, fireRate: 1.5, damage: 16,
    projectileSpeed: 640, color: "towerBasic",
    desc: "가장 가까운(가장 많이 진행한) 적 하나에 빠른 탄속으로 사격",
  },
  cannon: {
    id: "cannon", name: "플라즈마 모르타르", short: "광역 폭발",
    cost: 108, category: "area", behavior: "splash",
    range: 150, fireRate: 0.75, damage: 24, splashRadius: 78,
    projectileSpeed: 380, color: "towerCannon",
    desc: "포탄이 착탄 지점 주변 전체에 폭발 피해",
  },
  frost: {
    id: "frost", name: "크라이오 이미터", short: "감속 / 방해",
    cost: 85, category: "control", behavior: "slow",
    range: 155, fireRate: 1.3, damage: 0,
    slowPct: 42, slowDuration: 1.5,
    projectileSpeed: 520, color: "towerFrost",
    desc: "범위 내 모든 적을 냉각시켜 이동속도 저하",
  },
  sniper: {
    id: "sniper", name: "레일건 타워", short: "장사거리 관통",
    cost: 155, category: "physical", behavior: "pierce",
    range: 340, fireRate: 0.42, damage: 42, pierceCount: 4,
    projectileSpeed: 1400, color: "towerSniper",
    desc: "가장 진행도가 높은 적부터 최대 4명을 한 줄로 관통",
  },
  poison: {
    id: "poison", name: "나노봇 타워", short: "지속 피해",
    cost: 118, category: "area", behavior: "poison",
    range: 150, fireRate: 0.95, damage: 5,
    poisonDps: 8, poisonDuration: 3.0, poisonMaxStacks: 3,
    projectileSpeed: 460, color: "towerPoison",
    desc: "명중 시 맹독을 주입, 중첩되는 지속 피해",
  },
  tesla: {
    id: "tesla", name: "테슬라 코일", short: "마비 / 방해",
    cost: 138, category: "control", behavior: "stun",
    range: 140, fireRate: 0.6, damage: 3, stunDuration: 1.1,
    color: "towerTesla",
    desc: "전격을 방출해 대상을 짧게 마비시킴",
  },
};

const TOWER_ORDER = ["basic", "cannon", "frost", "sniper", "poison", "tesla"];

// 적 이동속도를 전반적으로 낮췄다(특히 인터셉터) — 타워 종류도 많고 판매·업그레이드까지
// 판단해야 하는데, 적이 너무 빨리 지나가면 생각할 시간이 없이 버거워진다는 피드백 반영.
const ENEMIES = {
  normal: {
    id: "normal", name: "드론", hp: 62, speed: 84, reward: 8,
    color: "enemyNormal", dodges: [], slowResist: 0, stunResist: 0, scale: 1.0,
    desc: "기본 정찰 드론. 체력·속도 모두 평범한 표준 위협.",
  },
  fast: {
    id: "fast", name: "인터셉터", hp: 32, speed: 182, reward: 9,
    color: "enemyFast", dodges: [], slowResist: 0, stunResist: 0, scale: 0.85,
    desc: "체력은 낮지만 매우 빠르게 돌진한다. 놓치기 쉬우니 주의.",
  },
  tank: {
    id: "tank", name: "저거너트", hp: 300, speed: 48, reward: 20,
    color: "enemyTank", dodges: [], slowResist: 0.6, stunResist: 0.65, scale: 1.35,
    desc: "느리지만 체력이 매우 높고, 감속·마비 효과에 강하게 저항한다.",
  },
  evasive: {
    id: "evasive", name: "클로킹 유닛", hp: 46, speed: 105, reward: 15,
    color: "enemyEvasive", dodges: ["physical"], slowResist: 0, stunResist: 0, scale: 1.0,
    ghost: true,
    desc: "단일 사격형(펄스 캐논·레일건)의 물리 공격을 완전히 무시한다. 광역·지속 피해·마비 계열 타워로 상대해야 한다.",
  },
  boss: {
    // scale을 너무 크게 잡으면 보스가 지나갈 때 주변 타워를 화면에서
    // 가려버려서(플레이어가 자기 타워를 못 봄) 체감상 답답해진다는 피드백에
    // 맞춰 축소함 — 그래도 일반 유닛보다는 확실히 커 보이는 수준으로.
    id: "boss", name: "오버로드", hp: 2200, speed: 40, reward: 170,
    color: "enemyBoss", dodges: [], slowResist: 0.4, stunResist: 0.4, scale: 1.7,
    isBoss: true,
    desc: "6웨이브에 등장하는 중간보스. 다른 적들과 함께 몰려오며, 기지를 통과하면 생명을 크게 잃는다.",
  },
  // 최종보스 — 중간보스와는 확실히 다른, 압도적인 위압감의 별도 개체.
  // 체력이 훨씬 높고 슬로우·마비 저항도 강해서 방해 효과로 쉽게 묶이지 않는다.
  // (스프라이트 자체가 스파이크가 더 길게 뻗어나가는 디자인이라, 같은 scale이어도
  // boss보다 시각적으로 더 크고 위협적으로 보인다 — 그래서 scale 배율 자체는
  // boss보다 조금만 더 크게만 잡아도 충분함, 타워를 가리지 않는 선에서.)
  finalboss: {
    // 5000(너무 쉬움) -> 6000(원복) -> 5500으로 한 번 더 조정. 6000과 5000
    // 사이 중간값으로 정착.
    id: "finalboss", name: "오버로드 프라임", hp: 5000, speed: 32, reward: 260,
    // 저항 0.6이었을 때는(예: 크라이오 이미터 최대 슬로우 80% 기준) 실제로는
    // 80%*(1-0.6)=32% 감속이 그대로 걸려서 "저항한다더니 잘 걸리네" 라는
    // 피드백이 나왔다. 0.85로 올려서 같은 상황에서 12%만 걸리게(체감상 거의
    // 안 걸리는 수준) 만듦 — 마비도 마찬가지 이유로 동일하게 올림.
    color: "enemyFinalBoss", dodges: [], slowResist: 0.85, stunResist: 0.85, scale: 1.85,
    isBoss: true,
    desc: "12웨이브 최종보스. 다른 모든 것을 압도하는 체력과 슬로우·마비 저항을 지녔으며, 기지에 도달하면 즉시 패배한다.",
  },
};

const ENEMY_ORDER = ["normal", "fast", "tank", "evasive", "boss", "finalboss"];

// 웨이브 구성: spawns = [{type, count, interval}] 순차 스폰
function s(type, count, interval) { return { type, count, interval }; }

// 웨이브 6(중간보스)을 넘기고 나면 확 쉬워진다는 피드백이 있어서:
// (1) 적 "수"를 전반적으로 늘려서 타워가 많아져도 물량으로 압박이 유지되게 하고
// (2) 중간보스도 혼자 오지 않고 다른 적들을 대동해서 오게 하고
// (3) 최종보스는 별개 개체(finalboss)로 훨씬 더 강하게, 역시 호위를 대동한다.
// 늘어난 처치 수만큼 개별 보상은 낮췄다(ENEMIES.reward 참고) — 그래야 골드가
// 그만큼 눈덩이처럼 불어나지 않는다.
// 1~4웨이브는 타워 2~3개만으로 생명 손실 없이 클리어되는 게 실측으로
// 확인돼서, 속도 하향으로 생긴 여유를 상쇄할 만큼만 살짝 더 늘림.
const WAVES = [
  { spawns: [s("normal", 10, 0.8)] },
  { spawns: [s("normal", 12, 0.7)] },
  { spawns: [s("normal", 9, 0.6), s("fast", 7, 0.45)] },
  { spawns: [s("fast", 13, 0.38)] },
  { spawns: [s("normal", 8, 0.55), s("tank", 4, 1.3)] },
  { spawns: [s("normal", 5, 0.5), s("fast", 5, 0.4), s("boss", 1, 1.0)], boss: true },
  { spawns: [s("fast", 9, 0.4), s("tank", 5, 1.1), s("normal", 4, 0.5)] },
  { spawns: [s("normal", 8, 0.45), s("evasive", 6, 0.8)] },
  { spawns: [s("fast", 8, 0.35), s("evasive", 7, 0.7), s("tank", 4, 1.1)] },
  { spawns: [s("tank", 7, 0.95), s("evasive", 7, 0.6), s("normal", 5, 0.5)] },
  { spawns: [s("normal", 8, 0.3), s("fast", 8, 0.3), s("tank", 6, 0.85), s("evasive", 8, 0.5)] },
  { spawns: [s("normal", 6, 0.4), s("fast", 6, 0.4), s("tank", 4, 0.9), s("evasive", 6, 0.5), s("finalboss", 1, 1.0)], boss: true },
];
