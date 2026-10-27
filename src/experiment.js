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

const HEAT_TIME = 4.0; // seconds
const WASH_TIME = 2.2; // seconds

const STEP_DEFS = [
  { title: "1단계", text: "가위를 들고 붉은 양배추를 잘라 비커에 담으세요." },
  { title: "2단계", text: "비커(양배추가 든)를 들고 싱크대 수도꼭지에 가져가 물을 부으세요." },
  { title: "3단계", text: "점화기로 알코올램프에 불을 붙인 뒤, 비커를 들고 쇠그물(삼발이) 위에 올려 가열하세요." },
  { title: "4단계", text: "충분히 우려낸 비커를 들고 빈 점적병에 가져가 체로 걸러 담으세요." },
  { title: "5단계", text: "여러 가지 용액을 각각의 시험관에 약 1/3씩 넣으세요. (6개 모두)" },
  { title: "6단계", text: "지시약이 든 점적병을 들고 각 시험관에 떨어뜨리세요. (6개 모두)" },
  { title: "7단계", text: "시험관을 클릭해 흔들며 색깔 변화를 관찰하세요. (6개 모두)" },
  { title: "마무리", text: "싱크대로 이동해 수도꼭지를 클릭해 물을 튼 다음, 다시 클릭해 손을 씻으세요." },
];

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

  function countFilledSolution() {
    let c = 0;
    for (let i = 1; i <= 6; i++) {
      if (get(`tube${i}`).userData.solution) c++;
    }
    return c;
  }

  function advanceStep() {
    state.stepIndex++;
    refreshUI();
  }

  function setBeakerLiquid(beaker, visible, color, opacity = 0.85, heightScale = 1) {
    const liquid = beaker.getObjectByName("liquid");
    liquid.visible = visible;
    if (color !== undefined) liquid.material.color.setHex(color);
    liquid.material.opacity = opacity;
    liquid.scale.y = heightScale;
    liquid.position.y = 0.01 + 0.14 * heightScale;
  }

  function setTubeLiquid(tube, visible, color, opacity = 0.75) {
    const liquid = tube.getObjectByName("liquid");
    liquid.visible = visible;
    if (color !== undefined) liquid.material.color.setHex(color);
    liquid.material.opacity = opacity;
  }

  // Returns { handled, heldConsume, targetConsume, snapWorldPosition }
  function tryUse(heldId, targetId) {
    if (!targetId || state.finished) return { handled: false };
    const held = get(heldId);

    switch (state.stepIndex) {
      case 0: {
        if (heldId === "scissors" && targetId === "cabbage") {
          const beaker1 = get("beaker1");
          beaker1.userData.hasCabbage = true;
          beaker1.getObjectByName("cabbageBits").visible = true;
          ui.toast("붉은 양배추를 잘라 비커에 담았습니다.");
          advanceStep();
          return { handled: true, heldConsume: false, targetConsume: true };
        }
        break;
      }
      case 1: {
        if (heldId === "beaker1" && (targetId === "sink_a_faucet" || targetId === "sink_b_faucet")) {
          const beaker1 = get("beaker1");
          if (!beaker1.userData.hasCabbage) {
            ui.toast("먼저 양배추를 잘라 비커에 담아야 합니다.");
            return { handled: false };
          }
          beaker1.userData.hasWater = true;
          setBeakerLiquid(beaker1, true, 0xbfe3c0, 0.75, 1);
          ui.toast("비커에 물을 부었습니다.");
          advanceStep();
          return { handled: true, heldConsume: false, targetConsume: false };
        }
        break;
      }
      case 2: {
        if (heldId === "igniter" && (targetId === "alcohol_lamp" || targetId === "wire_mesh")) {
          state.lampLit = true;
          const lamp = get("alcohol_lamp");
          lamp.getObjectByName("flame").visible = true;
          lamp.getObjectByName("flameLight").intensity = 1.1;
          ui.toast("알코올램프에 불을 붙였습니다. 화상에 주의하세요!");
          return { handled: true, heldConsume: false, targetConsume: false };
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
          const tripod = get("wire_mesh");
          const restPoint = tripod.getObjectByName("restPoint");
          ui.toast("가열을 시작합니다. 잠시만 기다리세요...");
          return {
            handled: true,
            heldConsume: false, targetConsume: false,
            snapWorldPosition: restPoint.getWorldPosition(new THREE.Vector3()),
            tag: "heating",
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
          bottle.getObjectByName("liquid").visible = true;
          bottle.getObjectByName("liquid").material.color.setHex(0x6a3e86);
          ui.toast("체로 걸러 점적병에 지시약을 담았습니다.");

          beaker1.userData.hasCabbage = false;
          beaker1.userData.hasWater = false;
          beaker1.userData.isExtract = false;
          beaker1.getObjectByName("cabbageBits").visible = false;
          setBeakerLiquid(beaker1, false);

          advanceStep();
          return { handled: true, heldConsume: false, targetConsume: false };
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
          setTubeLiquid(tube, true, 0xe3f2fd, 0.5);
          ui.toast(`${held.userData.name}을(를) ${tube.userData.name}에 넣었습니다.`);
          const filled = countFilledSolution();
          refreshUI();
          if (filled >= 6) {
            ui.toast("여섯 시험관에 모두 용액을 넣었습니다!");
            advanceStep();
          }
          return { handled: true, heldConsume: false, targetConsume: false };
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
          setTubeLiquid(tube, true, color, 0.85);
          ui.toast("지시약 다섯 방울을 떨어뜨렸습니다. 색이 변했어요!");
          const filled = countFilled("hasIndicator");
          refreshUI();
          if (filled >= 6) {
            ui.toast("모든 시험관의 색이 변했습니다!");
            advanceStep();
          }
          return { handled: true, heldConsume: false, targetConsume: false };
        }
        break;
      }
      default:
        break;
    }
    return { handled: false };
  }

  // Direct tap (no held item required): faucet toggle, tube shake/observe, wash
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
      return { handled: true, shake: true };
    }

    if (targetId === "sink_a_faucet" || targetId === "sink_b_faucet") {
      if (state.stepIndex < 7) {
        ui.toast("아직 실험이 끝나지 않았습니다.");
        return { handled: false };
      }
      if (!state.waterOn) {
        state.waterOn = true;
        ui.toast("물이 나옵니다. 다시 클릭해서 손을 씻으세요.");
        return { handled: true, water: "on", sink: targetId };
      }
      if (!state.washing) {
        state.washing = true;
        state.washProgress = 0;
        ui.toast("손을 씻는 중...");
        return { handled: true, washing: true };
      }
    }
    return { handled: false };
  }

  function update(dt) {
    if (state.heating) {
      state.heatProgress += dt;
      if (state.heatProgress >= HEAT_TIME) {
        state.heating = false;
        const beaker1 = get("beaker1");
        beaker1.userData.isExtract = true;
        setBeakerLiquid(beaker1, true, 0x6a3e86, 0.85, 1);
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

  return { state, tryUse, tryTap, update };
}
