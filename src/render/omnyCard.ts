import * as T from 'three';
import { canvasTexture } from './platformArt';

export function omnyCardFactory() {
  const front = canvasTexture(512, 320, (ctx) => {
    const corners = ['#f26b59', '#ec8dcc', '#7bd4f1', '#e1e85f'];

    ctx.fillStyle = '#f7f7f3';
    ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#161b24';
    ctx.fillRect(0, 0, 512, 18);
    ctx.font = '900 139px Arial, sans-serif';
    ctx.fillText('OMNY', 28, 202);
    ctx.font = 'bold 29px Arial, sans-serif';
    ctx.fillText('TAP TO RIDE', 31, 251);

    for (const [index, color] of corners.entries()) {
      ctx.fillStyle = color;
      ctx.fillRect(343 + index * 32, 229, 32, 46);
    }
  });
  const rim = new T.MeshStandardMaterial({ color: 0xb9d6dd, roughness: 0.35 });
  const face = new T.MeshBasicMaterial({ map: front });
  const geometry = new T.BoxGeometry(0.43, 0.269, 0.023);
  const materials = [rim, rim, rim, rim, face, face];

  return () => new T.Mesh(geometry, materials);
}
