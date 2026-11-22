import * as T from 'three';
import { seededRandom } from '../sim/encounters.ts';
import { canvasTexture } from './platformArt';

export function interiorMaterials() {
  const random = seededRandom(427119);
  const flooring = canvasTexture(1024, 256, (ctx) => {
    ctx.fillStyle = '#414951';
    ctx.fillRect(0, 0, 1024, 256);

    const chips = ['#829099', '#a5a5a0', '#252d35', '#68747e', '#adb4b8', '#323941'];

    for (let i = 0; i < 7400; i++) {
      ctx.fillStyle = chips[Math.floor(random() * chips.length)];
      ctx.globalAlpha = 0.38 + random() * 0.55;
      ctx.fillRect(random() * 1024, random() * 256, 0.65 + random() * 2.2, 0.55 + random() * 1.6);
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(23, 25, 29, .30)';
    ctx.fillRect(0, 4, 1024, 2);
    ctx.fillRect(0, 250, 1024, 2);
  });
  const grain = canvasTexture(256, 256, (ctx) => {
    const wash = ctx.createLinearGradient(0, 0, 0, 256);

    wash.addColorStop(0, '#919ca2');
    wash.addColorStop(0.38, '#c3c8ca');
    wash.addColorStop(0.52, '#adb7bd');
    wash.addColorStop(1, '#89959c');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 1150; i++) {
      const opacity = random() * 0.23;

      ctx.fillStyle =
        i % 3 === 0 ? `rgba(250, 253, 255, ${opacity})` : `rgba(39, 50, 60, ${opacity})`;

      ctx.fillRect(random() * 256, random() * 256, 5 + random() * 113, 0.45 + random() * 0.55);
    }
  });

  return {
    floor: new T.MeshPhysicalMaterial({
      map: flooring,
      roughness: 0.72,
      clearcoat: 0.17,
      clearcoatRoughness: 0.57,
    }),
    wall: new T.MeshPhysicalMaterial({
      map: grain,
      roughness: 0.45,
      metalness: 0.44,
      anisotropy: 0.29,
      clearcoat: 0.06,
      clearcoatRoughness: 0.45,
    }),
  };
}
