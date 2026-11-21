import * as T from 'three';

export function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new T.CanvasTexture(canvas);

  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;

  return texture;
}

function grime(ctx: CanvasRenderingContext2D, width: number, height: number, seed: number) {
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

    return seed / 4294967296;
  };

  for (let index = 0; index < 1350; index++) {
    const x = random() * width;
    const y = random() * height;

    ctx.fillStyle = index % 4 === 0 ? 'rgba(224, 209, 160, .24)' : 'rgba(36, 29, 18, .14)';
    ctx.fillRect(x, y, 1 + random() * 4, 1 + random() * 5);
  }

  for (let index = 0; index < 34; index++) {
    const x = random() * width;
    const y = random() * height;
    const fade = ctx.createLinearGradient(x, y, x, y + 45);

    fade.addColorStop(0, 'rgba(42, 36, 22, .28)');
    fade.addColorStop(1, 'rgba(42, 36, 22, 0)');
    ctx.fillStyle = fade;
    ctx.fillRect(x, y, 1 + random() * 5, 15 + random() * 50);
  }
}

export function platformMaterials() {
  const tile = canvasTexture(512, 288, (ctx) => {
    ctx.fillStyle = '#57534a';
    ctx.fillRect(0, 0, 512, 288);

    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 9; col++) {
        const shade = (row * 11 + col * 7 + row * col * 3 + 120) % 21;
        const x = col * 64 + (row % 2) * 32;

        ctx.fillStyle = `rgb(${163 + shade}, ${156 + shade}, ${135 + shade})`;
        ctx.fillRect(x + 1, row * 36 + 1, 62, 34);
        ctx.fillStyle = 'rgba(228, 220, 193, .35)';
        ctx.fillRect(x + 1, row * 36 + 1, 62, 2);
      }
    }

    grime(ctx, 512, 288, 562);
    const leak = ctx.createLinearGradient(0, 0, 0, 288);

    leak.addColorStop(0, 'rgba(41, 33, 24, .32)');
    leak.addColorStop(0.26, 'rgba(41, 33, 24, .05)');
    leak.addColorStop(0.7, 'rgba(41, 33, 24, 0)');
    leak.addColorStop(1, 'rgba(41, 33, 24, .45)');
    ctx.fillStyle = leak;
    ctx.fillRect(0, 0, 512, 288);
  });

  tile.wrapS = T.RepeatWrapping;
  tile.repeat.x = 11;

  const concrete = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#8b8271';
    ctx.fillRect(0, 0, 256, 256);
    grime(ctx, 256, 256, 199);
    ctx.strokeStyle = 'rgba(39, 32, 22, .35)';
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(26, 74);
    ctx.lineTo(20, 107);
    ctx.lineTo(39, 166);
    ctx.lineTo(43, 256);
    ctx.stroke();
  });

  concrete.wrapS = T.RepeatWrapping;
  concrete.wrapT = T.RepeatWrapping;
  concrete.repeat.set(13, 2);

  return {
    wall: new T.MeshStandardMaterial({ map: tile, roughness: 0.92 }),
    floor: new T.MeshStandardMaterial({ map: concrete, roughness: 1 }),
  };
}

const posters = [
  {
    name: 'NIGHT MARKET',
    line: 'FRIDAYS • LOWER EAST SIDE',
    paper: '#2b2455',
    ink: '#ffd769',
    accent: '#ff6c91',
  },
  {
    name: 'CITY SOUNDS',
    line: 'LIVE JAZZ • WEST VILLAGE',
    paper: '#e9ae57',
    ink: '#302143',
    accent: '#95455a',
  },
  {
    name: 'FOLD COFFEE',
    line: 'ESPRESSO • BROOKLYN',
    paper: '#183e42',
    ink: '#d7f1b8',
    accent: '#74b6ad',
  },
  {
    name: 'OPEN STUDIO',
    line: 'PRINTMAKING • CHELSEA',
    paper: '#aa423a',
    ink: '#fff1cc',
    accent: '#efb453',
  },
];

export function addPoster(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  index: number,
) {
  const { name, line, paper, ink, accent } = posters[index % posters.length];
  const map = canvasTexture(512, Math.round((512 * height) / width), (ctx) => {
    const h = ctx.canvas.height;

    ctx.fillStyle = '#222723';
    ctx.fillRect(0, 0, 512, h);
    ctx.fillStyle = paper;
    ctx.fillRect(9, 9, 494, h - 18);

    ctx.save();
    ctx.beginPath();
    ctx.rect(9, 9, 494, h - 18);
    ctx.clip();
    ctx.strokeStyle = accent;

    for (let ring = 0; ring < 6; ring++) {
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.ellipse(426, h * 0.55, 30 + ring * 16, h * (0.13 + ring * 0.032), -0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
    ctx.fillStyle = ink;
    ctx.font = '900 61px system-ui, sans-serif';
    ctx.fillText(name, 24, h * 0.49, 372);
    ctx.font = 'bold 25px monospace';
    ctx.fillText(line, 26, h * 0.69, 335);
  });
  const mesh = new T.Mesh(
    new T.PlaneGeometry(width, height),
    new T.MeshBasicMaterial({ map, toneMapped: false }),
  );

  mesh.position.set(x, y, z);
  parent.add(mesh);
}
