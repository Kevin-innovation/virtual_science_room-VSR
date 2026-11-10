// Animated processes for every state change: pouring, filtering, filling, heating,
// ignition, cutting, shaking, washing, the emergency shower and breakage.
import * as THREE from "three";
import { buildSieve, setLevel } from "./items.js";
import { SHOWER } from "./constants.js";
import * as ui from "./ui.js";

const TILT = 0.5;
const POUR_REACH = 0.25;
const POUR_IN = 0.35;
const POUR_HOLD = 1.1;
const POUR_OUT = 0.4;
const DRIP_INTERVAL = 0.12;
const DROP_FALL = 0.35;
const SIEVE_REST = 0.16; // filter origin height above the bottle base (ring sits on the mouth)
const CABBAGE_EXTRACT = 0x6a3e86;
const GRAVITY = 9.8;

const dropGeo = new THREE.SphereGeometry(0.012, 8, 6);
const sprayGeo = new THREE.SphereGeometry(0.018, 6, 4);
const sprayMat = new THREE.MeshStandardMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.8 });
const steamGeo = new THREE.SphereGeometry(0.05, 8, 6);
const shardGeo = new THREE.BoxGeometry(0.02, 0.02, 0.02);

const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const noop = () => {};

export function createEffects({ scene, registry }) {
  const state = {
    washing: 0, // seconds of hand-washing motion left
    showering: 0, // seconds of emergency-shower spray left
    flameLevel: 0, // 0 = unlit, 1 = full flame
  };

  const tweens = []; // { t, dur, step(k), done }
  const drops = []; // falling pour droplets
  const shards = []; // broken glass
  const steams = []; // rising steam
  const sprays = []; // shower water
  let steamSource = null;
  let steamLeft = 0;
  let steamTimer = 0;

  function tween(dur, step, done) {
    tweens.push({ t: 0, dur: Math.max(dur, 1e-4), step, done });
  }

  // Run phases one after another. Each phase: { dur, start?, step? }.
  function chain(phases, done) {
    let i = 0;
    const next = () => {
      if (i >= phases.length) {
        if (done) done();
        return;
      }
      const p = phases[i++];
      if (p.start) p.start();
      tween(p.dur, p.step ?? noop, next);
    };
    next();
  }

  function liquidTo(liquid, level, color, opacity, dur) {
    const from = liquid.userData.level ?? 0;
    const c0 = liquid.material.color.clone();
    const c1 = color !== undefined ? new THREE.Color(color) : c0.clone();
    if (opacity !== undefined) liquid.material.opacity = opacity;
    tween(dur, (k) => {
      setLevel(liquid, from + (level - from) * k);
      liquid.material.color.lerpColors(c0, c1, k);
    });
  }

  function wobble(obj, axis, amp, dur, done) {
    const base = obj.rotation[axis];
    tween(
      dur,
      (k) => {
        obj.rotation[axis] = base + Math.sin(k * Math.PI * 6) * amp * (1 - k);
      },
      () => {
        obj.rotation[axis] = base;
        if (done) done();
      }
    );
  }

  function vanish(obj, dur, done) {
    tween(
      dur,
      (k) => obj.scale.setScalar(Math.max(1 - k, 0.001)),
      () => {
        obj.visible = false;
        obj.scale.setScalar(1);
        if (done) done();
      }
    );
  }

  function appear(obj, dur) {
    obj.scale.setScalar(0.01);
    tween(dur, (k) => obj.scale.setScalar(Math.max(k, 0.01)));
  }

  function spawnDrop(x, yFrom, z, color, yTo) {
    const mesh = new THREE.Mesh(dropGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.2 }));
    mesh.position.set(x, yFrom, z);
    scene.add(mesh);
    drops.push({ mesh, t: 0, from: yFrom, to: yTo });
  }

  // Tilt the item over the target, let drops fall in, then set it back down beside it.
  function pour(item, target, m, done) {
    const tp = target.getWorldPosition(new THREE.Vector3());
    const ilq = item.getObjectByName("liquid");
    const tlq = target.getObjectByName("liquid");
    const from = item.position.clone();
    const rx0 = item.rotation.x;
    const rz0 = item.rotation.z;
    const pose = new THREE.Vector3(tp.x + POUR_REACH * Math.sin(TILT), tp.y + 0.3, tp.z);
    const setDown = new THREE.Vector3(tp.x, tp.y - 0.03, tp.z + 0.2);
    const dripColor = m.dripColor ?? (ilq ? ilq.material.color.getHex() : 0xffffff);
    const mouthY = tp.y + 0.3 + POUR_REACH * Math.cos(TILT);
    const dropTo = tp.y + 0.24;
    let sieve = null;
    let nextDrip = 0;
    item.userData.busy = true;

    const phases = [];
    if (m.filter) {
      // the filter is placed on the bottle automatically, then the extract is poured through it
      phases.push({
        dur: 0.5,
        start() {
          sieve = buildSieve("sieve_auto");
          const label = sieve.getObjectByName("label");
          if (label) sieve.remove(label);
          sieve.position.set(tp.x, tp.y + 0.6, tp.z);
          scene.add(sieve);
        },
        step: (k) => {
          sieve.position.y = tp.y + 0.6 + (tp.y + SIEVE_REST - (tp.y + 0.6)) * k;
        },
      });
    }
    phases.push({
      dur: POUR_IN,
      step: (k) => {
        item.position.lerpVectors(from, pose, k);
        item.rotation.x = rx0 * (1 - k);
        item.rotation.z = rz0 + (TILT - rz0) * k;
      },
    });
    phases.push({
      dur: POUR_HOLD,
      start() {
        if (tlq) liquidTo(tlq, m.targetLevel ?? tlq.userData.level ?? 0, m.targetColor, m.targetOpacity, POUR_HOLD);
      },
      step: (k) => {
        item.position.copy(pose);
        item.rotation.z = TILT + Math.sin(k * POUR_HOLD * 12) * 0.12;
        const elapsed = k * POUR_HOLD;
        while (elapsed >= nextDrip) {
          spawnDrop(tp.x, mouthY, tp.z, dripColor, dropTo);
          nextDrip += DRIP_INTERVAL;
        }
      },
    });
    phases.push({
      dur: POUR_OUT,
      start() {
        if (m.filter && ilq) liquidTo(ilq, 0, undefined, undefined, POUR_OUT);
      },
      step: (k) => {
        item.position.lerpVectors(pose, setDown, k);
        item.rotation.z = TILT * (1 - k);
      },
    });
    if (m.filter) {
      phases.push({
        dur: 0.4,
        step: (k) => {
          sieve.position.y = tp.y + SIEVE_REST + k * 0.5;
          sieve.scale.setScalar(1 - k * 0.8);
        },
      });
    }

    chain(phases, () => {
      item.rotation.x = 0;
      item.rotation.z = 0;
      if (m.filter) {
        const bits = item.getObjectByName("cabbageBits");
        if (bits) bits.visible = false;
      }
      if (sieve) scene.remove(sieve);
      item.userData.busy = false;
      done();
    });
  }

  // Move the beaker under the faucet and let the water fill it.
  function fill(item, sinkMesh, pose, m, done) {
    const from = item.position.clone();
    const rx0 = item.rotation.x;
    const rz0 = item.rotation.z;
    const ilq = item.getObjectByName("liquid");
    item.userData.busy = true;
    chain(
      [
        {
          dur: 0.5,
          step: (k) => {
            item.position.lerpVectors(from, pose, k);
            item.rotation.x = rx0 * (1 - k);
            item.rotation.z = rz0 * (1 - k);
          },
        },
        {
          dur: 0.25,
          start() {
            if (sinkMesh) sinkMesh.visible = true;
          },
          step: (k) => {
            if (sinkMesh) sinkMesh.scale.y = Math.max(k, 0.01);
          },
        },
        {
          dur: m.duration,
          start() {
            if (ilq) liquidTo(ilq, m.level, m.color, m.opacity, m.duration);
          },
        },
      ],
      () => {
        if (sinkMesh) {
          sinkMesh.scale.y = 1;
          sinkMesh.visible = !!m.keepOn;
        }
        item.userData.busy = false;
        done();
      }
    );
  }

  // Move the beaker onto the tripod, and tint it while it heats (with steam rising).
  function heat(item, m, done) {
    const from = item.position.clone();
    const ilq = item.getObjectByName("liquid");
    item.userData.busy = true;
    if (ilq) liquidTo(ilq, ilq.userData.level, CABBAGE_EXTRACT, 0.85, m.duration);
    steamSource = item;
    steamLeft = m.duration;
    chain(
      [
        {
          dur: 0.6,
          step: (k) => item.position.lerpVectors(from, m.rest, k),
        },
      ],
      () => {
        item.userData.busy = false;
        done();
      }
    );
  }

  // Strike the igniter, then the lamp flame grows.
  function ignite(igniter, done) {
    const lamp = registry.get("alcohol_lamp");
    const flame = lamp.getObjectByName("flame");
    const light = lamp.getObjectByName("flameLight");
    const rz0 = igniter.rotation.z;
    igniter.userData.busy = true;
    chain(
      [
        {
          dur: 0.6,
          step: (k) => {
            igniter.rotation.z = rz0 + Math.sin(k * Math.PI * 6) * 0.5 * (1 - k * 0.5);
          },
        },
        {
          dur: 0.1,
          start() {
            flame.visible = true;
          },
        },
        {
          dur: 0.7,
          step: (k) => {
            state.flameLevel = k;
            light.intensity = 1.1 * k;
          },
        },
      ],
      () => {
        igniter.rotation.z = rz0;
        igniter.userData.busy = false;
        done();
      }
    );
  }

  // Snip a few times, then the shredded cabbage appears in the beaker.
  function cut(scissors, done) {
    const beaker = registry.get("beaker1");
    const bits = beaker.getObjectByName("cabbageBits");
    const rz0 = scissors.rotation.z;
    scissors.userData.busy = true;
    chain(
      [
        {
          dur: 0.9,
          step: (k) => {
            scissors.rotation.z = rz0 + Math.sin(k * Math.PI * 8) * 0.35;
          },
        },
        {
          dur: 0.5,
          start() {
            bits.visible = true;
            bits.scale.setScalar(0.01);
          },
          step: (k) => bits.scale.setScalar(Math.max(k, 0.01)),
        },
      ],
      () => {
        scissors.rotation.z = rz0;
        scissors.userData.busy = false;
        done();
      }
    );
  }

  function shatter(pos, color) {
    for (let i = 0; i < 9; i++) {
      const mesh = new THREE.Mesh(shardGeo, new THREE.MeshStandardMaterial({ color }));
      mesh.position.copy(pos);
      mesh.position.y += 0.05;
      scene.add(mesh);
      shards.push({
        mesh,
        t: 0,
        v: new THREE.Vector3((Math.random() - 0.5) * 1.6, 1 + Math.random() * 1.4, (Math.random() - 0.5) * 1.6),
      });
    }
  }

  function spawnSpray() {
    const mesh = new THREE.Mesh(sprayGeo, sprayMat);
    mesh.position.set(
      SHOWER.x + (Math.random() - 0.5) * 0.35,
      2.7,
      SHOWER.z + (Math.random() - 0.5) * 0.35
    );
    scene.add(mesh);
    sprays.push({ mesh, vy: -1.8 - Math.random() });
  }

  function spawnSteam(pos) {
    const mesh = new THREE.Mesh(
      steamGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })
    );
    mesh.position.copy(pos);
    mesh.position.y += 0.1;
    scene.add(mesh);
    steams.push({ mesh, t: 0 });
  }

  function faucetOn(sinkMesh) {
    sinkMesh.visible = true;
    sinkMesh.scale.y = 0.01;
    tween(0.3, (k) => (sinkMesh.scale.y = Math.max(k, 0.01)));
  }

  function shower(sec) {
    state.showering = Math.max(state.showering, sec);
    ui.setShowerOverlay(true);
  }

  // Play the motion for an action. ctx: { item, target, sinkMesh, fillPose }.
  function run(m, ctx, done) {
    const finish = done ?? noop;
    switch (m.type) {
      case "cut":
        return cut(ctx.item, finish);
      case "ignite":
        return ignite(ctx.item, finish);
      case "fill":
        return fill(ctx.item, ctx.sinkMesh, ctx.fillPose, m, finish);
      case "heat":
        return heat(ctx.item, m, finish);
      case "pour":
        return pour(ctx.item, ctx.target, m, finish);
      case "observe":
        return wobble(ctx.target, "z", 0.25, 0.8, finish);
      case "faucet":
        if (ctx.sinkMesh) faucetOn(ctx.sinkMesh);
        return finish();
      case "wash":
        state.washing = Math.max(state.washing, m.duration);
        if (ctx.sinkMesh && !ctx.sinkMesh.visible) faucetOn(ctx.sinkMesh);
        return finish();
      default:
        return finish();
    }
  }

  function update(dt, t) {
    // tweens (iterate backwards so finished ones can be removed in place)
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      const k = Math.min(tw.t / tw.dur, 1);
      tw.step(ease(k));
      if (k >= 1) {
        tweens.splice(i, 1);
        if (tw.done) tw.done();
      }
    }

    // flame flicker, scaled by how far the flame has been lit
    const lamp = registry.get("alcohol_lamp");
    const flame = lamp?.getObjectByName("flame");
    if (flame && flame.visible) {
      const s = 1 + Math.sin(t * 20) * 0.08;
      const L = state.flameLevel;
      flame.scale.set(s * L, (1 + Math.sin(t * 13) * 0.12) * L, s * L);
    }

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.t += dt;
      const k = Math.min(d.t / DROP_FALL, 1);
      d.mesh.position.y = d.from + (d.to - d.from) * k * k; // accelerates like gravity
      if (k >= 1) {
        scene.remove(d.mesh);
        d.mesh.material.dispose();
        drops.splice(i, 1);
      }
    }

    for (let i = shards.length - 1; i >= 0; i--) {
      const s = shards[i];
      s.t += dt;
      s.v.y -= GRAVITY * dt;
      s.mesh.position.addScaledVector(s.v, dt);
      s.mesh.rotation.x += dt * 9;
      s.mesh.rotation.z += dt * 7;
      if (s.mesh.position.y < 0) s.mesh.position.y = 0;
      if (s.t > 1.0) {
        scene.remove(s.mesh);
        s.mesh.material.dispose();
        shards.splice(i, 1);
      }
    }

    if (steamLeft > 0 && steamSource) {
      steamLeft -= dt;
      steamTimer -= dt;
      if (steamTimer <= 0) {
        spawnSteam(steamSource.position);
        steamTimer = 0.15;
      }
    }
    for (let i = steams.length - 1; i >= 0; i--) {
      const s = steams[i];
      s.t += dt;
      s.mesh.position.y += dt * 0.25;
      s.mesh.scale.setScalar(1 + s.t * 1.5);
      s.mesh.material.opacity = Math.max(0, 0.35 * (1 - s.t / 1.5));
      if (s.t > 1.5) {
        scene.remove(s.mesh);
        s.mesh.material.dispose();
        steams.splice(i, 1);
      }
    }

    if (state.showering > 0) {
      state.showering -= dt;
      for (let i = 0; i < 3; i++) spawnSpray();
      if (state.showering <= 0) {
        state.showering = 0;
        ui.setShowerOverlay(false);
      }
    }
    for (let i = sprays.length - 1; i >= 0; i--) {
      const s = sprays[i];
      s.vy -= GRAVITY * 0.3 * dt;
      s.mesh.position.y += s.vy * dt;
      if (s.mesh.position.y < 0.02) {
        scene.remove(s.mesh);
        sprays.splice(i, 1);
      }
    }

    if (state.washing > 0) state.washing = Math.max(0, state.washing - dt);
  }

  return { state, run, vanish, appear, shatter, shower, update };
}
