# VSR — Virtual Science Room (가상 과학실)

붉은 양배추 지시약 실험을 1인칭 3D 가상 과학실에서 직접 수행하는 웹 프로토타입입니다.
Three.js로 구현했으며, 실제 과학실 스케치(`Main_Room.png`)를 기반으로 방을 구성하고
`자료.txt`에 정의된 실험 절차를 상태 머신으로 구현했습니다.

- **라이브 데모**: https://virtual-science-room-vsr.vercel.app
- **저장소**: https://github.com/Kevin-innovation/virtual_science_room-VSR

---

## 1. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 렌더링 엔진 | [Three.js](https://threejs.org/) `^0.169.0` | WebGL 기반 3D 렌더링. 씬/카메라/조명/레이캐스팅 전부 직접 구성 |
| 빌드 도구 | [Vite](https://vitejs.dev/) `^5.4.10` | 개발 서버(HMR) + 프로덕션 번들링. 프레임워크 없는 순수 ESM 구조 |
| 언어 | JavaScript (ES Modules) | TypeScript 미사용. 타입 안정성보다 프로토타입 속도를 우선 |
| 1인칭 컨트롤 | `three/examples/jsm/controls/PointerLockControls.js` | 브라우저 Pointer Lock API 래퍼 |
| UI 오버레이 | 순수 HTML/CSS (DOM) | 3D 씬 위에 겹치는 단계 안내/체크리스트/툴팁/토스트는 Canvas가 아닌 일반 DOM으로 구현 |
| 배포 | [Vercel](https://vercel.com/) | Vite 프레임워크 자동 감지(Zero-config), `main` 브랜치 push 시 GitHub 연동 자동 배포 |
| 패키지 매니저 | npm | `package-lock.json` 커밋됨 |

외부 상태관리 라이브러리, 물리 엔진, 3D 모델 포맷(GLTF 등)은 사용하지 않습니다.
모든 오브젝트는 Three.js 기본 지오메트리(Box/Cylinder/Sphere/Torus 등) 조합으로 직접 모델링한
"프로시저럴 로우폴리" 에셋입니다 — 별도의 3D 모델링 툴/에셋 파이프라인이 없습니다.

---

## 2. 실행 방법

```bash
npm install        # 의존성 설치
npm run dev         # 개발 서버 (http://localhost:5173, HMR)
npm run build        # 프로덕션 빌드 (dist/)
npm run preview      # 빌드 결과 로컬 미리보기
```

배포는 Vercel GitHub 연동으로 `main` 브랜치에 push하면 자동으로 이루어집니다.
수동 배포가 필요하면:

```bash
npx vercel --prod
```

---

## 3. 디렉터리 구조

```
index.html              # 진입 HTML. 시작 화면/크로스헤어/단계 UI/토스트/종료 화면 마크업 포함
src/
  main.js                # 앱 엔트리포인트 — 씬/카메라/렌더러, 이동, 레이캐스트 상호작용, 메인 루프
  constants.js            # 방 치수·가구 좌표·플레이어 반경·상호작용 사거리 등 공유 상수
  room.js                 # 방 지오메트리 빌더 (벽/바닥/천장/창문/싱크대/샤워기/책상/조명)
  items.js                # 실험 도구 16종 + 고정 설비(알코올램프/삼발이/시험관대) 메시 빌더
  experiment.js            # 실험 8단계 상태 머신 (판정 로직 + 색상/타이머 계산)
  ui.js                   # DOM 오버레이 갱신 헬퍼 (단계 배너/체크리스트/툴팁/토스트/종료화면)
  style.css               # 오버레이 UI 스타일
docs/
  2027_DGIST_AISW_인공지능기본과정_준비안내.md   # 포트폴리오 제출 맥락 문서
  print-a4-portrait.css
Main_Room.png             # 손그림 레퍼런스 스케치 (방 구조 기준)
자료.txt                  # 실험 절차/준비물/조작 스펙 원본 메모
```

### 모듈 의존 관계

```
main.js
 ├─ constants.js   (공유 상수)
 ├─ room.js        (scene을 받아 지오메트리를 추가하고 roomInfo 반환)
 ├─ items.js        (scene + roomInfo를 받아 아이템 메시를 추가하고 registry(Map) 반환)
 ├─ experiment.js    (registry를 받아 단계 상태 머신 생성)
 └─ ui.js            (DOM 직접 참조, 다른 모듈에서도 import해 사용)
```

`room.js`와 `items.js`는 Three.js `Scene`에 직접 `add()`하고, 식별에 필요한 메타데이터를
`Object3D.userData`에 저장합니다. 전역 상태 저장소(Redux 등)는 없고, 모든 상태는
각 오브젝트의 `userData`(아이템별 상태)와 `experiment.js`의 `state` 객체(진행 단계/타이머)에
분산되어 있습니다.

---

## 4. 좌표계 및 공간 레이아웃 (`constants.js`)

Three.js 기본 좌표계(오른손 좌표계, Y-up, 카메라 기본 정면 = `-Z`)를 그대로 사용합니다.

| 구역 | X 범위 | 비고 |
|---|---|---|
| 메인 실험실 | `-9.3 ~ 9` | 하늘색 벽, 창문 2개, 싱크대 2개, 비상 샤워기, 책상 2개 |
| 재료실(재료 보관 구역) | `9 ~ 16.3` | 물리적 벽 구분 없이 바닥 색/표지판으로만 구분된 같은 방(open room) |

| 가구 | 위치 (x, z) | 역할 |
|---|---|---|
| 책상 A (가열대) | (-5.5, 1.6) | 알코올램프 + 삼발이/쇠그물 고정 배치 |
| 책상 B (관찰대) | (-2.2, -1.6) | 시험관대 + 시험관 6개 고정 배치 |
| 공급 테이블 | (11.5, 0) | 재료실, 들 수 있는 아이템 16종이 한 줄로 진열 |
| 싱크대 A / B | (-7.2, -5.3) / (2.0, -5.3) | 수도꼭지 = 상호작용 히트박스 |
| 비상 샤워기 | (8.2, -4.9) | 장식용(기능 없음, 스케치 재현 목적) |
| 플레이어 스폰 | (-3, 1.6, 4) | 방 중앙, 뒷벽을 바라보는 방향 |

기타 상수: `PLAYER_RADIUS = 0.35`(원기둥 충돌 반경), `REACH = 3.2`(상호작용 레이캐스트 사거리).

---

## 5. 플레이어 이동 & 카메라 (`main.js`)

- **시점 제어**: `PointerLockControls` — 캔버스 클릭 시 `controls.lock()` 호출 → 브라우저
  Pointer Lock API로 마우스 커서를 숨기고 `movementX/Y` 델타로 시점 회전.
- **이동**: 매 프레임 `camera.getWorldDirection()`으로 카메라 정면 벡터를 구해 Y성분을 0으로
  만든 뒤(피치 무시), `forward × up`으로 오른쪽 벡터를 계산. WASD 입력을 이 두 벡터에 합성해
  프레임 독립적(`dt` 기반) 이동량을 산출합니다. 점프/중력 없음(스펙상 불필요).
- **충돌 처리**: 물리 엔진 없이 AABB(axis-aligned bounding box) 목록(`roomInfo.colliders`)과
  플레이어 원형 반경을 비교하는 자체 구현. X축, Z축을 **개별적으로** 검사해 벽을 따라
  미끄러지듯 이동(슬라이딩)하도록 처리합니다.

---

## 6. 상호작용 시스템 (집기 / 놓기 / 회전 / 탭)

조작 체계: **좌클릭으로 집기/상호작용, 우클릭으로 내려놓기/사용, 들고 있는 동안 휠로 회전**.
(초기 버전은 `자료.txt`의 "좌클릭 꾹 누르면 들기/떼면 놓기" 홀드 방식이었으나, 실제 플레이
테스트 피드백에 따라 좌클릭=집기, 우클릭=놓기의 명시적 클릭 방식으로 변경했습니다.)

### 6.1 식별 모델

- 모든 상호작용 가능한 오브젝트는 `userData = { id, name, carryable, ... }`를 가집니다.
- 레이캐스트는 `registry`(Map, id → 루트 `Object3D`)의 전체 값을 후보로 사용하며,
  `raycaster.intersectObjects(candidates, true)`로 자식 메시까지 재귀 검사한 뒤
  `findInteractable()`이 부모 체인을 최대 10단계까지 거슬러 올라가 `userData.id`가
  있는 가장 가까운 조상(=루트 오브젝트)을 반환합니다. 라벨 스프라이트, 액체 메시,
  얼음(장식) 메시 등 자식 요소를 직접 클릭해도 항상 올바른 루트 아이템으로 귀속됩니다.
- `raycaster.far = REACH(3.2)`로 사거리를 제한합니다.

> **카메라는 반드시 `scene.add(camera)`로 씬 그래프에 포함되어야 합니다.** Three.js
> 렌더러는 `scene`에서부터 재귀 순회하며 그릴 대상을 수집하기 때문에, 카메라가 씬의
> 자식이 아니면 카메라에 부모를 붙인 "손에 든 아이템"은 트랜스폼은 정상인데도 순회
> 대상에서 제외되어 **화면에 전혀 그려지지 않는** 문제가 있었습니다. (`main.js` 최상단)

### 6.2 집기 / 탭 (좌클릭, mousedown button 0)

```
손이 비어있고 조준된 대상 있음
  ├─ carryable === true  → pickUp(): scene에서 제거 → camera의 자식으로 재부모화
  │                         (로컬 좌표 (0.32, -0.28, -0.75)에 고정 = 1인칭 시점 우하단)
  └─ carryable === false → experiment.tryTap(id) 즉시 실행 (수도꼭지 on/off, 손씻기, 시험관 관찰)
이미 손에 들고 있으면 좌클릭은 아무 동작도 하지 않습니다(놓기는 우클릭 전담).
```

### 6.3 회전 (wheel, 들고 있는 동안만)

`heldItem.rotation.y += e.deltaY * 0.0025` — 휠을 굴릴수록 들고 있는 물체가 Y축을 중심으로
회전합니다. 선택적 기능이며 실험 단계 판정에는 영향을 주지 않습니다(자유 회전).

### 6.4 놓기 / 사용 (우클릭, mousedown button 2 → `releaseHeld()`)

```
손에 들고 있음 (우클릭)
  → target = 현재 크로스헤어가 가리키는 오브젝트(없을 수 있음)
  → experiment.tryUse(heldId, targetId) 호출 → 실험 단계 규칙과 매칭되는지 판정
  → result.handled === true (유효한 "held→target" 조합)
       ├─ result.targetConsume    → 대상 오브젝트 비활성화(소모). 예: 잘린 양배추
       ├─ result.heldConsume      → 들고 있던 아이템 소모(현재 실험에서는 미사용, 확장용)
       ├─ result.snapWorldPosition → 지정된 월드 좌표에 정확히 스냅, 중력 미적용
       │                             (예: 삼발이 `restPoint` 위 비커 — 의도된 정밀 배치)
       └─ 위 셋 다 아니면        → target(또는 정면 1.3m 지점)의 XZ 좌표로 중력 낙하 시작
  → result.handled === false (스텝과 맞지 않는 조합, 또는 대상 없음)
       └─ 위와 동일하게 중력 낙하 시작 (§7.4 참고)
```

`disableInteraction()`은 `visible = false` 처리와 함께 모든 자식 메시의 `raycast`를
no-op으로 덮어써, 소모되었거나 깨진 오브젝트가 이후 레이캐스트에서 "유령 타겟"으로
다시 잡히는 것을 방지합니다.

### 6.5 툴팁

매 프레임 `updateTooltip()`이 현재 조준 대상을 재계산해 `[집기]`(carryable) 또는
`[상호작용]`(fixed) 라벨을 표시합니다. 아이템을 들고 있을 때는 "내려놓기 → {타겟 이름}"으로
전환됩니다.

---

## 7. 실험 상태 머신 (`experiment.js`)

`자료.txt`의 실험 절차를 **8단계** 선형 상태 머신으로 구현했습니다. `tryUse(heldId, targetId)`는
`state.stepIndex`에 따른 `switch` 분기로 현재 단계에서 유효한 조합만 허용하고, 그 외 조합은
`{ handled: false }`를 반환해 아무 일도 일어나지 않습니다(안내 토스트만 표시되는 경우 있음).

| # | 단계 | 판정 조건 (hold → target) | 효과 |
|---|---|---|---|
| 0 | 양배추 자르기 | `scissors` → `cabbage` | 비커1에 양배추 투입 표시, 양배추 오브젝트 소모 |
| 1 | 물 붓기 | `beaker1`(양배추 있음) → `sink_a\|b_faucet` | 비커 액체 표시(연두색) |
| 2a | 점화 | `igniter` → `alcohol_lamp` **또는** `wire_mesh`(삼발이/쇠그물) | `state.lampLit = true`, 불꽃 메시 표시 + 포인트라이트 점등 |
| 2b | 가열 | `beaker1`(양배추+물) → `wire_mesh`(삼발이) *램프 점화 필요* | 비커를 삼발이 `restPoint`에 스냅, 4초 타이머 시작 → 완료 시 액체 보라색으로 변색 |
| 3 | 여과 | `beaker1`(우려냄 완료) → `indicator_bottle` | 점적병 활성화(지시약 완성), 비커 초기화(빈 상태로) |
| 4 | 용액 붓기 (×6) | `sol_*`(6종 중 하나) → `tube1~6`(빈 시험관) | 시험관에 옅은 색 액체 표시, 6/6 채워지면 다음 단계로 |
| 5 | 지시약 투입 (×6) | `indicator_bottle` → `tube1~6`(용액 있음) | 용액 종류별 산/염기 색상 적용, 6/6 완료 시 다음 단계 |
| 6 | 관찰 (×6, 탭) | 빈손으로 `tube1~6` 클릭(`tryTap`) | "흔들며 관찰" 기록, 6/6 완료 시 마무리 단계로 |
| 7 | 마무리 | 빈손으로 `sink_*_faucet` 두 번 클릭(`tryTap`) | 1차: 물 틀기, 2차: 2.2초 손씻기 타이머 → 종료 화면 표시 |

> **알코올램프와 삼발이는 같은 좌표에 겹쳐 배치**되어 있습니다(실제 실험 기구처럼 램프가
> 삼발이 다리 사이에 들어가는 구조). 쇠그물(얇은 원판)이 시야를 가려 램프 몸체를 직접
> 조준하기 어려운 각도가 많기 때문에, 점화 판정은 `alcohol_lamp`와 `wire_mesh` 두 타겟
> 모두에 대해 성립하도록 했습니다 — 쇠그물을 조준해도 "버너에 불을 붙인다"는 의미로 통합.

### 7.1 단계 4~6의 "다중 완료" 처리

`countFilled(prop)` / `countFilledSolution()` 헬퍼가 `tube1`~`tube6`의 `userData`를 순회해
완료 개수를 세고, 상단 단계 배너에 `(n/6)`으로 실시간 노출합니다. 6개 모두 충족되면
`advanceStep()`이 호출되어 다음 단계로 넘어갑니다. 즉 5·6·7단계는 "임의 순서로 6회 반복"을
하나의 `stepIndex`로 취급하는 구조입니다.

### 7.2 색상 매핑 (교육용 단순화)

실제 적색 양배추 지시약의 연속적인 pH 색 변화를 프로토타입 단순화를 위해 용액별 고정 색상
하나씩으로 매핑했습니다(`PH_COLOR`, `experiment.js`):

| 용액 | 산/염기 | 매핑 색상 |
|---|---|---|
| 식초 | 산성 | 붉은 분홍 `#ff4569` |
| 사이다 | 약산성 | 분홍 `#ff8fab` |
| 빨랫비누 물 | 약염기성 | 청록 `#4fd1c5` |
| 석회수 | 염기성 | 파랑 `#4fa3ff` |
| 묽은 염산 | 강산성 | 진한 빨강 `#e53935` |
| 묽은 수산화나트륨 | 강염기성 | 노랑 `#fdd835` |

> 실제 실험 결과와 색상/민감도가 다를 수 있습니다. 포트폴리오 문서가 강조하는
> "가상 실험이 실제와 다를 수 있음을 비교"하는 지점으로 활용할 수 있습니다.

### 7.3 타이머

- **가열 타이머**: `HEAT_TIME = 4.0초`. `state.heating === true`인 동안 매 프레임 `update(dt)`에서
  `heatProgress`를 누적, 도달 시 비커 액체를 보라색으로 변경하고 자동으로 다음 단계로 진행.
- **손 씻기 타이머**: `WASH_TIME = 2.2초`. 동일한 패턴으로 `washing` 상태를 누적 후 완료 시
  `state.finished = true` + `ui.showEndScreen()` 호출.

이 두 타이머는 `main.js`의 메인 루프에서 매 프레임 `experiment.update(dt)`로 구동되며,
플레이어가 다른 행동을 하는 동안에도 백그라운드에서 진행됩니다(가열 중 자유롭게 이동 가능).

### 7.4 중력 낙하 & 파손 (`main.js`)

실험 로직과 무관한 "물리" 레이어를 메인 루프에 별도로 두었습니다. 아이템을 우클릭으로
내려놓을 때, **정밀 배치(`snapWorldPosition`, 예: 삼발이 위 비커)나 완전 소모가 아닌 모든
경우**는 아래의 단순 수직 중력 시뮬레이션을 거칩니다.

```
releaseHeld()에서 target의 XZ(또는 정면 드롭 지점)로 이동 + 현재(든 채였던) 높이 유지
  → startFalling(item, breakable): fallingItems 목록에 { vy: 0, startY } 등록
  → 매 프레임 updateFalling(dt):
       vy += GRAVITY(-9.8) * dt
       position.y += vy * dt
       findGroundY(x, z): 바닥/책상 상판/싱크대 카운터 메시(roomInfo.groundMeshes)로
                           아래 방향 레이캐스트 → 착지 높이 계산
       position.y <= groundY 이면 착지, fallingItems에서 제거
         → breakable && (startY - groundY) > BREAK_FALL_HEIGHT(0.5m) 이면 breakItem() 호출
```

`roomInfo.groundMeshes`는 `room.js`가 바닥 2장, 책상 상판 3개(책상 A/B, 공급 테이블),
싱크대 카운터 2개를 모아 반환합니다. 비커·점적병류는 `items.js`에서 `breakable: true`로
표시되어 있고, 가위·점화기·체·장갑류 등은 깨지지 않습니다.

이 설계 덕분에 "용액을 올바른 시험관에 붓기"처럼 책상 높이에서 책상 높이로 내려놓는
정상적인 사용(낙차 약 0.3~0.4m)은 깨지지 않고, 허공이나 바닥 한가운데 아무렇게나 놓는
경우(낙차 약 1.2~1.3m)만 파손으로 이어집니다 — 판정 기준은 "스텝 로직상 올바른 사용인지"가
아니라 순수히 **낙하 거리**입니다.

`breakItem()`은 토스트로 파손을 알리고 오브젝트를 숨긴 뒤(`disableInteraction` 재사용),
1.5초 후 재료실 원래 자리(`userData.spawnPosition`, `items.js`의 `add()` 헬퍼가 생성 시점에
기록)로 되돌려 놓습니다. 비커/지시약 병은 이때 내부 상태(양배추·물·우려냄·지시약 충전 여부)도
함께 초기화되어, 실수로 핵심 아이템을 깨뜨려도 실험이 막히지 않습니다.

### 7.5 화상 위험 (`main.js`의 `updateBurnCheck`)

알코올램프가 점화된 상태(`experiment.state.lampLit`)에서 플레이어 카메라와 램프의 거리가
`BURN_RADIUS(1.3m)` 안으로 들어오면, 2초 쿨다운(`BURN_COOLDOWN`)으로 경고 토스트("뜨거워요!
화상을 입었습니다")와 화면 전체에 붉은 비네트가 깜빡이는 `#burn-flash` 오버레이
(`ui.flashBurn()`)를 띄웁니다. 실제 피해/체력 시스템은 없고, 자료.txt의 주의사항("알코올램프
사용 시 화상 주의")을 시각·텍스트 피드백으로 체감하게 하는 수준입니다.

---

## 8. 재료 목록 ↔ 구현 매핑 (`items.js`)

`자료.txt` "준비물" 전 항목을 재료실 공급 테이블(`SUPPLY_TABLE`) 위에 한 줄로 배치했습니다.

| 준비물 | 아이템 ID | 들 수 있음 | 비고 |
|---|---|---|---|
| 비커(500mL) ×2 | `beaker1`, `beaker2` | ✅ *(파손 가능)* | `beaker2`는 현재 실험 로직 미사용(예비/확장용) |
| 점적병(빈 병) | `indicator_bottle` | ✅ *(파손 가능)* | 여과 후 지시약 병으로 전환 |
| 알코올램프 | `alcohol_lamp` | ❌(고정) | 책상 A·삼발이와 동일 좌표에 고정, 점화 시 불꽃/조명 토글. 점화 반경 안에 오래 머물면 화상(§7.5) |
| 삼발이 + 쇠그물 | `wire_mesh` | ❌(고정) | `restPoint` 자식 오브젝트가 비커 거치 높이를 제공. 점화 타겟으로도 사용됨(§7 표 각주) |
| 점화기 | `igniter` | ✅ | 램프 점화용, 소모되지 않고 재사용 가능 |
| 체 | `sieve` | ✅ | 현재는 소지만 가능(여과 연출은 비커→점적병 조합으로 단순화) |
| 가위 | `scissors` | ✅ | 양배추 자르기용, 소모되지 않음 |
| 붉은 양배추 1/6통 | `cabbage` | ✅ | 1단계 완료 시 소모(비활성화) |
| 반코팅 면장갑 | `coated_gloves` | ✅ | 소지 가능, 판정 로직 없음(안전 소품) |
| 시험관 6개 | `tube1` ~ `tube6` | ❌(고정, 시험관대) | 책상 B에 배치, 용액/지시약 상태를 `userData`로 추적 |
| 시험관대 | `tube_rack` | ❌(고정) | 장식용 받침대 |
| 용액 6종 점적병 | `sol_vinegar`, `sol_cider`, `sol_soap`, `sol_limewater`, `sol_hcl`, `sol_naoh` | ✅ *(파손 가능)* | 선분사(prefilled) 상태로 생성 |
| 붉은 양배추 지시약 점적병 | `indicator_bottle`과 동일 | ✅ | 위 항목과 동일 오브젝트(빈 병 → 지시약 병) |
| 보안경 | `goggles` | ✅ | 소지 가능, 판정 로직 없음(안전 소품) |
| 실험용 장갑 | `lab_gloves` | ✅ | 소지 가능, 판정 로직 없음(안전 소품) |
| 물 | — | — | 아이템이 아닌 싱크대 수도꼭지 상호작용(`sink_*_faucet`)으로 구현 |

안전 소품(장갑·보안경 등)은 몰입감을 위해 배치했지만, `자료.txt`의 주의사항("가위질/화상 주의")은
점화 시 토스트 메시지("화상에 주의하세요!")로만 안내하고 있으며, 착용 여부를 강제하는 판정은
프로토타입 범위상 구현하지 않았습니다.

---

## 9. UI 오버레이 (`ui.js`, `style.css`, `index.html`)

3D 캔버스 위에 겹치는 모든 UI는 Three.js가 아닌 **일반 DOM 엘리먼트**로 구현했습니다
(`position: fixed` + `z-index` 레이어링). Canvas에 직접 텍스트를 그리지 않기 때문에
해상도 독립적이고 CSS로 쉽게 스타일링할 수 있습니다.

| 엘리먼트 | 역할 |
|---|---|
| `#blocker` / `#instructions` | 시작 화면, 조작법 안내, "클릭해서 입장하기" 버튼 |
| `#crosshair` | 화면 중앙 고정 십자선 |
| `#tooltip` | 조준 대상 이름 + 집기/상호작용 라벨 |
| `#step-banner` (`#step-index`, `#step-text`) | 현재 단계 번호/설명, 다중 단계는 `(n/6)` 진행률 포함 |
| `#checklist` | 8단계 전체 목록, 완료(✓)/진행 중(▶)/대기(・) 상태 표시 |
| `#toast` | 일시적 피드백 메시지(2.6초 후 페이드아웃) |
| `#end-screen` | 실험 종료 화면 |

---

## 10. 알려진 제약 / 다음 개선 과제

- **번들 크기**: 프로덕션 빌드 단일 JS 청크가 약 507KB(gzip 131KB)로 Vite 권고 임계치(500KB)를
  초과합니다. Three.js를 동적 import하거나 `manualChunks`로 분리하면 개선 가능합니다.
  (현재는 번들이 하나뿐인 간단한 구조를 유지하기 위해 의도적으로 두었습니다.)
- **아이템 라벨 겹침**: 책상 B의 시험관 6개처럼 근접 배치된 아이템의 스프라이트 라벨이
  멀리서 볼 때 서로 겹쳐 읽기 어려운 경우가 있습니다.
- **마우스 감도**: `PointerLockControls` 기본 감도를 그대로 사용하며, 별도의 감도 조절 UI는
  없습니다.
- **`beaker2`, `sieve`, `coated_gloves`, `goggles`, `lab_gloves`**: 재료실에 배치되어 들 수 있지만
  현재 실험 단계 판정 로직에는 연결되어 있지 않은 "예비/연출용" 아이템입니다.
- **중력은 수직 1축만 시뮬레이션**합니다(§7.4). 수평 튕김/구르기, 다른 아이템과의 충돌은 없고
  바닥/상판에 닿으면 즉시 정지합니다. 깨지는 연출도 파티클 없이 즉시 사라지는 수준입니다.
- **화상은 토스트+화면 비네트 피드백뿐**이며 체력치나 실패 조건으로 이어지지는 않습니다.
- **저장/이어하기 없음**: 새로고침하면 진행 상태가 초기화됩니다(단일 세션 프로토타입).
- **모바일/터치 미지원**: Pointer Lock + WASD 전제로, 데스크톱 브라우저(Chrome/Edge 권장) 기준으로
  동작을 확인했습니다.

---

## 11. 배포 구성

- Vercel 프로젝트: `dlab-daegu/virtual-science-room-vsr` — Vite 프레임워크 자동 감지
  (Build Command `vite build`, Output Directory `dist`), 별도 `vercel.json` 없음(Zero-config).
- GitHub 저장소(`Kevin-innovation/virtual_science_room-VSR`)와 연동되어 있어 `main` 브랜치에
  push하면 자동으로 프로덕션 배포가 트리거됩니다.
- 로컬 전용 파일(`.vercel/`, `.env*`)은 `.gitignore`에 등록되어 있습니다.
