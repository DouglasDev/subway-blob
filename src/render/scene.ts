import * as T from 'three';
import { Ride } from '../sim/ride.ts';
import { buildBlob } from './blobMesh';
import { buildCar, buildTrack } from './carScene';
import { buildRiders } from './riders';
import { buildRideObjects } from './rideObjects';
import { buildPowerEffects } from './powerEffects';
import { buildHazards } from './hazards';
import { brakingLurch } from '../sim/trainMotion.ts';
import { buildSmoke } from './smoke';

export function createScene(canvas: HTMLCanvasElement, ride: Ride, arcade = false) {
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: !arcade,
    powerPreference: 'high-performance',
  });

  renderer.setPixelRatio(arcade ? 1 : Math.min(window.devicePixelRatio, 1.6));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16 * (arcade ? 1.2 : 1);
  const scene = new T.Scene();

  scene.background = new T.Color(0x152123);
  scene.fog = new T.FogExp2(0x152123, 0.058);
  scene.add(new T.HemisphereLight(0xe8f3e0, 0x645447, 2.32));
  const key = new T.DirectionalLight(0xffe2a3, 2.36);

  key.position.set(-3, 6, -4);
  scene.add(key);
  const fill = new T.DirectionalLight(0xb7ebf4, 1.4);

  fill.position.set(2, 2, 6);
  scene.add(fill);

  const fieldOfView = () => (arcade ? 37 : canvas.dataset.touch === 'true' ? 43 : 48);

  const camera = new T.PerspectiveCamera(fieldOfView(), 1, 0.1, 55);
  const focus = new T.Vector3(0, 0.78, -0.29);
  const goal = new T.Vector3();
  const car = new T.Group();

  scene.add(car);
  const updateCar = buildCar(car);
  const updateTrack = buildTrack(scene);
  const updateCrowd = buildRiders(car);
  const updateObjects = buildRideObjects(car);
  const updatePower = buildPowerEffects(car);
  const updateSmoke = buildSmoke(car);
  const updateBlob = buildBlob(car, ride.fluid, ride.mask);
  const updateHazards = buildHazards(car);
  const burst = new T.Group();
  const dropGeometry = new T.IcosahedronGeometry(0.078, 1);
  const dropMaterial = new T.MeshStandardMaterial({
    color: 0xbdf070,
    emissive: 0x577a24,
    roughness: 0.3,
  });
  const drops = Array.from({ length: 62 }, (_, index) => {
    const mesh = new T.Mesh(dropGeometry, dropMaterial);
    const angle = index * 2.39996;

    burst.add(mesh);

    return {
      mesh,
      scale: 0.56 + (index % 7) * 0.18,
      vx: Math.cos(angle) * (1 + (index % 4) * 0.61),
      vz: Math.sin(angle) * (1 + (index % 4) * 0.61),
      vy: 1.9 + (index % 7) * 0.56,
    };
  });

  burst.visible = false;
  const shockwave = new T.Mesh(
    new T.TorusGeometry(1, 0.039, 8, 44),
    new T.MeshBasicMaterial({ color: 0xbaff85, transparent: true, depthWrite: false }),
  );

  shockwave.rotation.x = -Math.PI / 2;
  burst.add(shockwave);
  car.add(burst);
  let popTime = 0;
  let lastTick = -1;
  let lastPhase = '';
  let aspect = 1;
  let cameraLift = 0;
  let pulsePhase = 0;
  let damagePhase = 0;
  let lastDamageStart = -Infinity;

  const resize = new ResizeObserver(() => {
    const { clientWidth, clientHeight } = canvas;

    if (!clientWidth || !clientHeight) return;

    aspect = clientWidth / clientHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
  });

  resize.observe(canvas);

  scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const material = object.material as T.MeshStandardMaterial;

    if (material.map) renderer.initTexture(material.map);
  });

  const screen = new T.Vector3();

  return {
    draw(dt: number) {
      const fov = fieldOfView();

      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }

      const popped = ride.phase === 'popped';

      const joltAge = ride.jolt ? ride.time - ride.jolt.at : Infinity;
      const braking = ride.jolt?.braking;
      const jolt =
        ride.jolt && joltAge < 0.56
          ? ride.jolt.strength *
            (braking ? brakingLurch(joltAge) : Math.sin(joltAge * 25) * Math.exp(-joltAge * 7.5))
          : 0;

      car.position.set(
        jolt * (braking ? 0.35 : 0.24),
        braking ? 0 : Math.abs(jolt) * 0.065,
        braking ? 0 : -jolt * 0.066,
      );

      car.rotation.z = -jolt * 0.028;

      if (lastTick !== ride.time || lastPhase !== ride.phase) {
        updateCar(ride.door, ride.stop);
        const acrobat =
          ride.act?.role === 'acrobat' && ride.encounter
            ? {
                id: ride.act.id,
                move: ride.encounter.variant,
                age: ride.time - ride.encounter.began,
              }
            : undefined;

        const shove = ride.shove;
        const shover = ride.act?.role === 'shover' ? ride.act : undefined;

        updateCrowd(
          ride.crowd.riders,
          acrobat,
          shove && shover
            ? { id: shover.id, age: ride.time - shove.at, heading: Math.atan2(shove.x, shove.z) }
            : undefined,
          ride.act?.role === 'sneezy' && ride.sneeze
            ? { id: ride.act.id, age: ride.time - ride.sneeze.at, at: ride.sneeze.at }
            : undefined,
        );

        updateObjects(ride);
        updatePower(ride);
        updateHazards(ride);
        lastTick = ride.time;
        lastPhase = ride.phase;
      }

      const inTunnel = ride.phase === 'running' || (popped && ride.travel > 0 && ride.travel < 1);

      updateTrack(ride.stop, ride.renderTravel, inTunnel, ride.time);
      const crazy = ride.animation?.cue === 'crazy' && ride.time < ride.animation.until;

      const squished = 1 - ride.tolerance;
      const heat = Math.max(squished, ride.squeeze, Math.min(1, ride.guestPressure * 0.52));

      pulsePhase =
        (pulsePhase + dt * Math.PI * 2 * (0.22 + 2.55 * squished ** 1.6)) % (Math.PI * 2);

      const pulse = Math.sin(pulsePhase) * squished ** 1.45 * 0.25;
      const flashTail = Math.max(0, 1 - (ride.time - ride.lastDamageAt) / 0.26);
      const severity = squished ** 1.45;

      if (ride.damageBeganAt !== lastDamageStart) {
        lastDamageStart = ride.damageBeganAt;
        damagePhase = 0;
      } else if (flashTail > 0) {
        damagePhase = (damagePhase + dt * Math.PI * 2 * (0.48 + 2.12 * severity)) % (Math.PI * 2);
      }

      const crest = 0.5 + 0.5 * Math.cos(damagePhase);
      const damageFlash = flashTail * (0.18 + 0.82 * severity) * (0.16 + 0.84 * crest ** 3);

      updateBlob(
        popped,
        heat,
        crazy ? Math.sin(ride.time * 28) : 0,
        ride.facing,
        ride.crowd.onboard,
        ride.time < ride.shieldUntil,
        ride.time < ride.fluidUntil,
        pulse * (1 - flashTail),
        damageFlash,
      );

      if (popped) {
        popTime += dt;
        burst.visible = popTime < 1.38;
        shockwave.position.y = -0.51;
        shockwave.scale.setScalar(0.15 + popTime * 3.8);
        shockwave.material.opacity = Math.max(0, 0.95 - popTime * 1.7);
        dropMaterial.color.setHex(popTime < 0.12 ? 0xf2ffca : 0xbdf070);
        burst.position.set(ride.fluid.x, 0.65, ride.fluid.z);

        for (const { mesh, vx, vy, vz, scale } of drops) {
          mesh.position.set(
            vx * popTime,
            Math.max(-0.63, vy * popTime - 7.8 * popTime ** 2),
            vz * popTime,
          );

          mesh.scale.setScalar(scale * Math.max(0, 1 - popTime * 0.74));
          mesh.rotation.set(popTime * 8, popTime * vx, popTime * vz);
        }
      }

      const performer = ride.act;
      const stageFocus =
        performer &&
        (performer.role === 'prank' ||
          performer.role === 'acrobat' ||
          performer.role === 'musician' ||
          performer.role === 'spreader');
      const guestWeight = stageFocus ? (performer.role === 'spreader' ? 0.32 : 0.18) : 0;
      const focusX = arcade
        ? T.MathUtils.lerp(ride.fluid.x * 0.98, performer?.x ?? 0, guestWeight * 0.52)
        : stageFocus
          ? ride.fluid.x * 0.56 + performer.x * (performer.role === 'spreader' ? 0.39 : 0.23)
          : ride.fluid.x * 0.74;

      goal.set(focusX, 0.85, (ride.fluid.z - 0.32) * (arcade ? 0.73 : 0.5));
      focus.lerp(goal, 1 - Math.exp(-4 * dt));
      cameraLift += (ride.squeeze * 1.55 - cameraLift) * (1 - Math.exp(-3 * dt));
      const narrow =
        aspect < 1 ? (1 - aspect) * (canvas.dataset.touch === 'true' ? 1.73 : 2.15) : 0;

      camera.position.set(
        focus.x + 2.15,
        (arcade ? 3.6 : 3.55) + cameraLift + narrow * 0.35,
        focus.z + 5.0 + narrow,
      );

      camera.lookAt(focus);
      camera.rotateZ(jolt * (braking ? 0.013 : 0.035));

      updateSmoke(
        !popped && performer?.role === 'smoker' ? performer : undefined,
        ride.time + popTime,
        camera,
      );

      renderer.render(scene, camera);
    },

    speechPosition(x: number, z: number) {
      screen.set(x, 1.83, z).project(camera);

      return {
        left: Math.max(20, Math.min(80, (screen.x + 1) * 50)),
        top: Math.max(19, Math.min(75, (1 - screen.y) * 50)),
      };
    },

    dispose() {
      resize.disconnect();
      const materials = new Set<T.Material>();
      const geometries = new Set<T.BufferGeometry>();

      scene.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;

        geometries.add(object.geometry);

        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          materials.add(material);
        if (object instanceof T.InstancedMesh) object.dispose();
      });

      for (const geometry of geometries) geometry.dispose();

      for (const material of materials) {
        if ('map' in material && material.map instanceof T.Texture) material.map.dispose();
        material.dispose();
      }

      renderer.dispose();
    },
  };
}
