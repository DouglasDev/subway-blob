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
  [0xc83667, '#ffe39a', '#842a68'],
  [0x3162c9, '#b7ffef', '#7335b2'],
  [0x197e78, '#faff9d', '#3ebc82'],
  [0xe4a142, '#432a81', '#ffdf72'],
  [0x8952c4, '#ffe1bc', '#d33d87'],
  [0xf26953, '#452754', '#ffae50'],
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

    switch (kind < 12 ? kind % 6 : kind - 6) {
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
      case 6:
        ctx.beginPath();
        ctx.moveTo(-8, -37);
        ctx.lineTo(24, -37);
        ctx.lineTo(5, -8);
        ctx.lineTo(32, -8);
        ctx.lineTo(-18, 39);
        ctx.lineTo(-8, 7);
        ctx.lineTo(-30, 7);
        ctx.closePath();
        ctx.fill();
        break;
      case 7:
        for (const x of [-30, 0, 30]) {
          ctx.beginPath();
          ctx.moveTo(x, -34);
          ctx.bezierCurveTo(x - 31, -14, x + 31, 14, x, 34);
          ctx.stroke();
        }

        break;
      case 8:
        for (const x of [-22, 22]) {
          ctx.beginPath();
          ctx.arc(x, 0, 23, 0, Math.PI * 2);
          ctx.stroke();
        }

        break;
      case 9:
        ctx.rotate(-0.38);
        ctx.fillRect(-35, -28, 56, 21);
        ctx.fillRect(-21, 2, 56, 24);
        break;
      case 10:
        for (let petal = 0; petal < 6; petal++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          ctx.ellipse(0, 23, 9, 14, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillRect(-5, -5, 10, 10);
        break;
      case 11:
        for (const x of [-27, 0, 27]) {
          ctx.beginPath();
          ctx.moveTo(x, -33);
          ctx.lineTo(x + 15, 0);
          ctx.lineTo(x, 33);
          ctx.lineTo(x - 15, 0);
          ctx.closePath();
          ctx.stroke();
        }

        break;
    }

    ctx.restore();
    ctx.fillStyle = accent;
    ctx.fillRect(38, 102, 52, 5);
  });
}

// Each silhouette is a set of ellipsoids in head-local coordinates.
export const hairstyles = [
  [[0, 1.624, -0.006, 0.126, 0.061, 0.121]], // cropped
  [[0, 1.649, -0.023, 0.151, 0.121, 0.141]], // curls
  [[0, 1.654, -0.011, 0.083, 0.111, 0.14]], // high top
  [
    [0, 1.606, -0.028, 0.14, 0.118, 0.124],
    [0, 1.505, -0.088, 0.14, 0.147, 0.089],
  ], // bob
  [
    [0, 1.605, -0.044, 0.143, 0.119, 0.12],
    [0, 1.387, -0.08, 0.155, 0.279, 0.088],
  ], // long
  [
    [0, 1.611, -0.034, 0.129, 0.09, 0.12],
    [0, 1.438, -0.134, 0.066, 0.225, 0.079],
  ], // ponytail
  [
    [0, 1.617, -0.049, 0.137, 0.084, 0.113],
    [-0.089, 1.71, -0.07, 0.068, 0.069, 0.062],
    [0.089, 1.71, -0.07, 0.068, 0.069, 0.062],
  ], // buns
] as const;

export const hairColors = [
  0x312421, 0x221a1a, 0x754d37, 0xc09558, 0x454454, 0x964d37, 0xd2bfac, 0x512c2e, 0xb12d67,
  0x397dce, 0x8058c9, 0x309987, 0xf07553,
];

const bottoms = [
  [0x29374d, 0xf0c66b],
  [0x284876, 0xf5e8c4],
  [0x9a383e, 0xf28f70],
  [0x317c77, 0xe8bd65],
  [0x8054a2, 0x9ee1e7],
  [0xb18a40, 0x485ba1],
  [0x425d43, 0xec996a],
  [0xae4b7c, 0xe6bde8],
  [0x4758a0, 0xe7f7aa],
  [0x41636b, 0xeee2dc],
  [0xc65c3c, 0x79bfb0],
  [0x594869, 0xff9ab0],
] as const;

export function riderStyle(id: number) {
  const style = Math.imul(id ^ 0x182bcfb3, 0x45d9f3b);
  const spread = (style ^ (style >>> 16)) >>> 0;
  const [bottom, sneaker] = bottoms[(spread >>> 14) % bottoms.length];

  return {
    shirt: (spread & 255) % shirts.length,
    hair: hairstyles[((spread >>> 8) & 31) % hairstyles.length],
    dye: hairColors[(spread >>> 22) % hairColors.length],
    cut: (spread >>> 13) % 10,
    bottom,
    sneaker,
  };
}
