// The player's body, shown in third-person view. Its right hand carries held items.
import * as THREE from "three";

export function createAvatar(scene) {
  const group = new THREE.Group();
  group.visible = false;

  const shirt = new THREE.MeshStandardMaterial({ color: 0x3f7fd6, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf1c7a0, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x3e2723 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.2), shirt);
  torso.position.y = 1.15;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skin);
  head.position.y = 1.62;
  group.add(head);

  // top half of a sphere, as hair
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.135, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    hair
  );
  hairCap.position.y = 1.64;
  group.add(hairCap);

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.16), pants);
    leg.position.set(side * 0.1, 0.38, 0);
    group.add(leg);
  }

  // Arms hang from shoulder pivots, so they can swing and rub.
  function makeArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.25, 1.38, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), shirt);
    arm.position.y = -0.25;
    pivot.add(arm);
    group.add(pivot);
    return pivot;
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // Where items sit in the right hand (end of the right arm).
  const handAnchor = new THREE.Object3D();
  handAnchor.position.set(0, -0.5, 0);
  armR.add(handAnchor);

  scene.add(group);

  return {
    handAnchor,
    show(v) {
      group.visible = v;
    },
    update(rig, { moving, holding, washing, t }) {
      group.position.set(rig.position.x, 0, rig.position.z);
      group.rotation.y = rig.rotation.y;

      const swing = moving ? Math.sin(t * 9) * 0.6 : 0;
      armL.rotation.x = swing;
      armR.rotation.x = holding ? 0.9 : -swing;

      if (washing) {
        // both hands rubbing under the water
        armR.rotation.x = 1.2 + Math.sin(t * 16) * 0.3;
        armL.rotation.x = 1.2 + Math.sin(t * 16 + Math.PI) * 0.3;
      }
    },
  };
}
