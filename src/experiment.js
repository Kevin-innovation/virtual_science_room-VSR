import * as THREE from "three";
import * as ui from "./ui.js";

const SOLUTION_IDS = ["sol_vinegar", "sol_cider", "sol_soap", "sol_limewater", "sol_hcl", "sol_naoh"];

// Simplified red-cabbage indicator colors per solution (educational approximation)
const PH_COLOR = {
  sol_vinegar: 0xff4569, // 산성 - 붉은 분홍
  sol_cider: 0xff8fab, // 약산성 - 분홍
  sol_soap: 0x4fd1c5, // 약염기성 - 청록
  sol_limewater: 0x4fa3ff, // 염기성 - 파랑
  sol_hcl: 0xe53935, // 강산성 - 진한 빨강
  sol_naoh: 0xfdd835, // 강염기성 - 노랑
};

export const HEAT_TIME = 4.0; // seconds
export const WASH_TIME = 2.2; // seconds

const BEAKER_WATER = 0xbfe3c0; // beaker with cabbage + water
const CABBAGE_EXTRACT = 0x6a3e86; // strained red-cabbage indicator
const SOLUTION_TINT = 0xe3f2fd; // a solution in a tube, before the indicator

const STEP_DEFS = [
  { title: "1단계", text: "가위를 들고 붉은 양배추를 잘라 비커에 담으세요." },
  { title: "2단계", text: "비커(양배추가 든)를 들고 싱크대 수도꼭지에 가져가 물을 부으세요." },
  { title: "3단계", text: "점화기로 알코올램프에 불을 붙인 뒤, 비커를 들고 쇠그물(삼발이) 위에 올려 가열하세요." },
  { title: "4단계", text: "충분히 우려낸 비커를 들고 빈 점적병을 조준해 옮겨 담으세요. (체는 자동으로 올라갑니다)" },
  { title: "5단계", text: "여러 가지 용액을 각각의 시험관에 약 1/3씩 넣으세요. (6개 모두)" },
  { title: "6단계", text: "지시약이 든 점적병을 들고 각 시험관에 떨어뜨리세요. (6개 모두)" },
  { title: "7단계", text: "시험관을 클릭해 흔들며 색깔 변화를 관찰하세요. (6개 모두)" },
  { title: "마무리", text: "싱크대로 이동해 수도꼭지를 클릭해 물을 튼 다음, 다시 클릭해 손을 씻으세요." },
];

// Game logic only. Visuals are described as `motion` objects and played by effects.js,
// so every change is shown as a process rather than appearing in one frame.
export function createExperiment(registry) {
  const state = {
    stepIndex: 0,
    lampLit: false,
    heating: false,
    heatProgress: 0,
    washing: false,
    washProgress: 0,
    waterOn: false,
    finished: false,
  };

  function get(id) {
    return registry.get(id);
  }

  function countFilled(prop) {
    let c = 0;
    for (let i = 1; i <= 6; i++) {
      if (get(`tube${i}`).userData[prop]) c++;
    }
    return c;
  }

  function countFilledSolution() {
    let c = 0;
    for (let i = 1; i <= 6; i++) {
      if (get(`tube${i}`).userData.solution) c++;
    }
    return c;
  }

  function refreshUI() {
    const def = STEP_DEFS[Math.min(state.stepIndex, STEP_DEFS.length - 1)];
    let text = def.text;
    if (state.stepIndex === 4) text = `${def.text} (${countFilledSolution()}/6)`;
    if (state.stepIndex === 5) text = `${def.text} (${countFilled("hasIndicator")}/6)`;
    if (state.stepIndex === 6) text = `${def.text} (${countFilled("observed")}/6)`;
    ui.setStep(def.title, text);

    ui.setChecklist(
      STEP_DEFS.map((d, i) => ({
        text: d.title,
        state: i < state.stepIndex ? "done" : i === state.stepIndex ? "current" : "todo",
      }))
    );
  }

  // PART_5: a broken ingredient must be recoverable. Losing the beaker's contents before the
  // extract is ready, or the indicator while it is being used, rewinds the experiment to the
  // cutting step so the cabbage can be fetched again. Returns true when a rewind happened.
  function handleBreak(id) {
    const s = state.stepIndex;
    const beakerLost = id === "beaker1" && s >= 1 && s <= 3;
    const indicatorLost = id === "indicator_bottle" && (s === 4 || s === 5);
    if (!beakerLost && !indicatorLost) return false;
    rewind();
    return true;
  }

  function rewind() {
    state.stepIndex = 0;
    state.heating = false;
    state.heatProgress = 0;
    for (let i = 1; i <= 6; i++) {
      const tube = get(`tube${i}`);
      tube.userData.solution = null;
      tube.userData.hasIndicator = false;
      tube.userData.observed = false;
    }
    const beaker = get("beaker1");
    beaker.userData.hasCabbage = false;
    beaker.userData.hasWater = false;
    beaker.userData.isExtract = false;
    get("indicator_bottle").userData.filled = false;
    ui.toast("재료가 깨져 처음부터 다시 준비해야 합니다. 양배추를 다시 잘라 주세요.", 3600);
    refreshUI();
  }

  function advanceStep() {
    state.stepIndex++;
    refreshUI();
  }

  // Returns { handled, targetConsume, motion }.
  //   motion.after: "drop" (fall from the crosshair), "settle" (set down where it ends
  //   up), or "stay" (remain where the motion left it).
  function tryUse(heldId, targetId) {
    if (!targetId || state.finished) return { handled: false };
    const held = get(heldId);

    switch (state.stepIndex) {
      case 0: {
        if (heldId === "scissors" && targetId === "cabbage") {
          get("beaker1").userData.hasCabbage = true;
          ui.toast("붉은 양배추를 잘라 비커에 담았습니다.");
          advanceStep();
          return {
            handled: true,
            targetConsume: true,
            motion: { type: "cut", after: "drop" },
          };
        }
        break;
      }
      case 1: {
        if (heldId === "beaker1" && (targetId === "sink_faucet")) {
          const beaker1 = get("beaker1");
          if (!beaker1.userData.hasCabbage) {
            ui.toast("먼저 양배추를 잘라 비커에 담아야 합니다.");
            return { handled: false };
          }
          beaker1.userData.hasWater = true;
          ui.toast("비커에 물을 붓고 있습니다...");
          advanceStep();
          return {
            handled: true,
            motion: { type: "fill", level: 0.22, color: BEAKER_WATER, opacity: 0.75, duration: 1.6, keepOn: state.waterOn, after: "stay" },
          };
        }
        break;
      }
      case 2: {
        if (heldId === "igniter" && (targetId === "alcohol_lamp" || targetId === "wire_mesh")) {
          state.lampLit = true;
          ui.toast("알코올램프에 불을 붙였습니다. 화상에 주의하세요!");
          return {
            handled: true,
            motion: { type: "ignite", after: "drop" },
          };
        }
        if (heldId === "beaker1" && targetId === "wire_mesh") {
          const beaker1 = get("beaker1");
          if (!beaker1.userData.hasCabbage || !beaker1.userData.hasWater) {
            ui.toast("양배추와 물이 든 비커를 준비하세요.");
            return { handled: false };
          }
          if (!state.lampLit) {
            ui.toast("먼저 점화기로 알코올램프에 불을 붙이세요.");
            return { handled: false };
          }
          state.heating = true;
          state.heatProgress = 0;
          const rest = get("wire_mesh").getObjectByName("restPoint").getWorldPosition(new THREE.Vector3());
          ui.toast("가열을 시작합니다. 잠시만 기다리세요...");
          return {
            handled: true,
            motion: { type: "heat", rest, duration: HEAT_TIME, after: "stay" },
          };
        }
        break;
      }
      case 3: {
        if (heldId === "beaker1" && targetId === "indicator_bottle") {
          const beaker1 = get("beaker1");
          if (!beaker1.userData.isExtract) {
            ui.toast("비커를 충분히 가열해 우려내야 합니다.");
            return { handled: false };
          }
          const bottle = get("indicator_bottle");
          bottle.userData.filled = true;
          ui.toast("체로 걸러 점적병에 지시약을 담았습니다.");

          beaker1.userData.hasCabbage = false;
          beaker1.userData.hasWater = false;
          beaker1.userData.isExtract = false;

          advanceStep();
          return {
            handled: true,
            motion: {
              type: "pour",
              filter: true,
              dripColor: CABBAGE_EXTRACT,
              targetColor: CABBAGE_EXTRACT,
              targetOpacity: 0.9,
              targetLevel: 0.1,
              after: "settle",
            },
          };
        }
        break;
      }
      case 4: {
        if (SOLUTION_IDS.includes(heldId) && targetId.startsWith("tube")) {
          const tube = get(targetId);
          if (tube.userData.solution) {
            ui.toast("이미 용액이 담긴 시험관입니다.");
            return { handled: false };
          }
          tube.userData.solution = heldId;
          ui.toast(`${held.userData.name}을(를) ${tube.userData.name}에 넣었습니다.`);
          const filled = countFilledSolution();
          refreshUI();
          if (filled >= 6) {
            ui.toast("여섯 시험관에 모두 용액을 넣었습니다!");
            advanceStep();
          }
          return {
            handled: true,
            motion: { type: "pour", targetColor: SOLUTION_TINT, targetOpacity: 0.5, targetLevel: 0.07, after: "settle" },
          };
        }
        break;
      }
      case 5: {
        if (heldId === "indicator_bottle" && targetId.startsWith("tube")) {
          const bottle = get("indicator_bottle");
          if (!bottle.userData.filled) {
            ui.toast("점적병에 지시약이 들어있지 않습니다.");
            return { handled: false };
          }
          const tube = get(targetId);
          if (!tube.userData.solution) {
            ui.toast("먼저 용액을 넣어야 합니다.");
            return { handled: false };
          }
          if (tube.userData.hasIndicator) {
            ui.toast("이미 지시약을 떨어뜨렸습니다.");
            return { handled: false };
          }
          tube.userData.hasIndicator = true;
          const color = PH_COLOR[tube.userData.solution] ?? 0xcccccc;
          ui.toast("지시약 다섯 방울을 떨어뜨렸습니다. 색이 변했어요!");
          const filled = countFilled("hasIndicator");
          refreshUI();
          if (filled >= 6) {
            ui.toast("모든 시험관의 색이 변했습니다!");
            advanceStep();
          }
          return {
            handled: true,
            motion: { type: "pour", dripColor: CABBAGE_EXTRACT, targetColor: color, targetOpacity: 0.85, after: "settle" },
          };
        }
        break;
      }
      default:
        break;
    }
    return { handled: false };
  }

  // Direct tap (no held item required): faucet on, tube observe, wash.
  function tryTap(targetId) {
    if (!targetId || state.finished) return { handled: false };

    if (state.stepIndex === 6 && targetId.startsWith("tube")) {
      const tube = get(targetId);
      if (!tube.userData.hasIndicator) {
        ui.toast("아직 지시약을 넣지 않은 시험관입니다.");
        return { handled: false };
      }
      if (tube.userData.observed) return { handled: false };
      tube.userData.observed = true;
      ui.toast(`${tube.userData.name}을(를) 흔들며 색 변화를 관찰했습니다.`);
      const count = countFilled("observed");
      refreshUI();
      if (count >= 6) {
        ui.toast("관찰을 모두 마쳤습니다! 이제 싱크대로 이동해 손을 씻으세요.");
        advanceStep();
      }
      return { handled: true, motion: { type: "observe" } };
    }

    if (targetId === "sink_faucet") {
      if (state.stepIndex < 7) {
        ui.toast("아직 실험이 끝나지 않았습니다.");
        return { handled: false };
      }
      if (!state.waterOn) {
        state.waterOn = true;
        ui.toast("물이 나옵니다. 다시 클릭해서 손을 씻으세요.");
        return { handled: true, motion: { type: "faucet" } };
      }
      if (!state.washing) {
        state.washing = true;
        state.washProgress = 0;
        ui.toast("손을 씻는 중...");
        return { handled: true, motion: { type: "wash", duration: WASH_TIME } };
      }
    }
    return { handled: false };
  }

  function update(dt) {
    if (state.heating) {
      state.heatProgress += dt;
      if (state.heatProgress >= HEAT_TIME) {
        state.heating = false;
        get("beaker1").userData.isExtract = true;
        ui.toast("양배추 색깔이 충분히 우러났습니다!");
        advanceStep();
      }
    }
    if (state.washing) {
      state.washProgress += dt;
      if (state.washProgress >= WASH_TIME) {
        state.washing = false;
        state.finished = true;
        ui.toast("손을 깨끗이 씻었습니다. 실험 종료!");
        ui.showEndScreen();
      }
    }
  }

  refreshUI();

  return { state, tryUse, tryTap, update, handleBreak };
}
