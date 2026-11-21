import * as T from 'three';
import { Ride } from '../sim/ride.ts';
import { buildBlob } from './blobMesh';
import { buildCar, buildTrack } from './carScene';
import { buildRiders } from './riders';
import { buildRideObjects } from './rideObjects';

export function createScene(canvas: HTMLCanvasElement, ride: Ride, arcade = false) {
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: !arcade,
    powerPreference: 'high-performance',
  });

  renderer.setPixelRatio(arcade ? 1 : Math.min(window.devicePixelRatio, 1.6));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
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

  const camera = new T.PerspectiveCamera(48, 1, 0.1, 55);
  const focus = new T.Vector3(0, 0.78, -0.29);
  const goal = new T.Vector3();
  const updateDoors = buildCar(scene);
  const updateTrack = buildTrack(scene);
  const updateCrowd = buildRiders(scene);
  const updateObjects = buildRideObjects(scene);
  const updateBlob = buildBlob(scene, ride.fluid, ride.mask);
  const burst = new T.Group();
  const dropGeometry = new T.IcosahedronGeometry(0.065, 1);
  const dropMaterial = new T.MeshStandardMaterial({
    color: 0xbdf070,
    emissive: 0x577a24,
    roughness: 0.3,
  });
  const drops = Array.from({ length: 34 }, (_, index) => {
    const mesh = new T.Mesh(dropGeometry, dropMaterial);
    const angle = index * 2.39996;

    burst.add(mesh);

    return {
      mesh,
      vx: Math.cos(angle) * (1 + (index % 4) * 0.61),
      vz: Math.sin(angle) * (1 + (index % 4) * 0.61),
      vy: 1.5 + (index % 7) * 0.45,
    };
  });

  burst.visible = false;
  scene.add(burst);
  let popTime = 0;
  let lastTick = -1;
  let lastPhase = '';
  let aspect = 1;
  let cameraLift = 0;

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
      const popped = ride.phase === 'popped';

      if (lastTick !== ride.time || lastPhase !== ride.phase) {
        updateDoors(ride.door);
        updateCrowd(ride.crowd.riders, ride.time);
        updateObjects(ride);
        lastTick = ride.time;
        lastPhase = ride.phase;
      }

      const inTunnel = ride.phase === 'running' || (popped && ride.travel > 0 && ride.travel < 1);

      updateTrack(ride.stop, ride.renderTravel, inTunnel, ride.time);
      const crazy = ride.animation?.cue === 'crazy' && ride.time < ride.animation.until;

      updateBlob(popped, ride.tolerance, crazy ? Math.sin(ride.time * 34) : 0);

      if (popped) {
        popTime += dt;
        burst.visible = popTime < 0.85;
        burst.position.set(ride.fluid.x, 0.65, ride.fluid.z);

        for (const { mesh, vx, vy, vz } of drops) {
          mesh.position.set(
            vx * popTime,
            Math.max(-0.63, vy * popTime - 5 * popTime ** 2),
            vz * popTime,
          );

          mesh.scale.setScalar(1 + popTime * -0.82);
        }
      }

      goal.set(ride.fluid.x * 0.74, 0.85, (ride.fluid.z - 0.32) * 0.5);
      focus.lerp(goal, 1 - Math.exp(-4 * dt));
      cameraLift += (ride.squeeze * 1.55 - cameraLift) * (1 - Math.exp(-3 * dt));
      const narrow = aspect < 1 ? (1 - aspect) * 2.15 : 0;

      camera.position.set(
        focus.x + 2.15,
        (arcade ? 3.6 : 3.55) + cameraLift + narrow * 0.35,
        focus.z + 5.0 + narrow,
      );

      camera.lookAt(focus);
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
