import { canvasTexture } from './platformArt';

const palettes = [
  [0x425c78, '#e4bf7c', '#25405d'],
  [0xd0a16c, '#427164', '#e2c88d'],
  [0x803f46, '#ffc998', '#58323d'],
  [0x3a5c4c, '#d5e4a7', '#265042'],
  [0xbdb39e, '#405c79', '#d17041'],
  [0x585173, '#ffbb9e', '#b5b3e3'],
  [0xb05b36, '#ffd98c', '#7a3437'],
  [0x304850, '#88d7ba', '#e8af66'],
  [0xcbb575, '#304c68', '#7d504c'],
  [0x7e6476, '#f2d29e', '#dcb5c0'],
  [0x476a75, '#f5df9c', '#569e93'],
  [0x314153, '#f2c2ab', '#ab6c7c'],
] as const;

export const shirts = palettes.map(([base]) => base);

export function garment(kind: number) {
  const [base, ink, accent] = palettes[kind];

  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#' + base.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 3, 128, 12);
    ctx.save();
    ctx.translate(64, 61);
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = kind < 6 ? 5 : 8;

    switch (kind % 6) {
      case 0:
        for (let row = -2; row <= 2; row++) {
          ctx.beginPath();
          ctx.moveTo(-52, row * 12 + 9);
          ctx.lineTo(-5, row * 12 - 14);
          ctx.lineTo(45, row * 12 + 1);
          ctx.stroke();
        }

        break;
      case 1:
        ctx.rotate(kind < 6 ? -0.22 : 0.32);

        for (let row = -2; row <= 2; row++) {
          for (let col = -2; col <= 2; col++) {
            if ((row + col) % 2 === 0) ctx.fillRect(col * 14 - 6, row * 13 - 6, 12, 11);
          }
        }

        break;
      case 2:
        for (let ring = 1; ring <= 4; ring++) {
          ctx.beginPath();
          ctx.ellipse(0, 0, ring * 10, ring * 6, -0.52, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillRect(0, -4, 8, 8);
        break;
      case 3:
        ctx.beginPath();

        for (let tip = 0; tip < 16; tip++) {
          const angle = (tip * Math.PI) / 8;
          const radius = tip % 2 ? 12 : 38;

          ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }

        ctx.closePath();
        ctx.fill();
        break;
      case 4:
        ctx.rotate(kind < 6 ? 0.26 : -0.3);

        for (let bar = -2; bar <= 2; bar++) {
          const height = 32 + (2 - Math.abs(bar)) * 11;

          ctx.fillRect(bar * 17 - 5, -height / 2, 9, height);
        }

        break;
      case 5:
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(side * 5, -34);
          ctx.bezierCurveTo(side * 53, -24, side * 53, 24, side * 5, 34);
          ctx.stroke();
        }

        ctx.fillRect(-4, -37, 8, 74);
        break;
    }

    ctx.restore();
    ctx.fillStyle = accent;
    ctx.fillRect(38, 102, 52, 5);
  });
}
