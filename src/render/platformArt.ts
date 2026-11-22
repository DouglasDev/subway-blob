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
  ['NIGHT MARKET', 'FRIDAYS • LOWER EAST SIDE', '#2b2455', '#ffd769', '#ff6c91'],
  ['CITY SOUNDS', 'LIVE JAZZ • WEST VILLAGE', '#e9ae57', '#302143', '#95455a'],
  ['FOLD COFFEE', 'ESPRESSO • BROOKLYN', '#183e42', '#d7f1b8', '#74b6ad'],
  ['OPEN STUDIO', 'PRINTMAKING • CHELSEA', '#aa423a', '#fff1cc', '#efb453'],
  ['BOROUGH BOOKS', 'USED BOOKS • EAST HARLEM', '#ece2cd', '#192d41', '#b54142'],
  ['OUT OF OFFICE', 'COMEDY • UNION SQUARE', '#261c22', '#ffe5fa', '#ec6b94'],
  ['BACKSPIN', 'RECORDS • THE BRONX', '#142e66', '#fcf7dc', '#74d4ff'],
  ['WINDOW SEAT', 'INDEPENDENT CINEMA', '#502157', '#fcea98', '#b87ab8'],
  ['LATE SLICE', 'PIZZA BY THE SLICE', '#f6d34d', '#82253b', '#b54d6a'],
  ['SECOND SHIFT', 'VINTAGE CLOTHING', '#1b493a', '#fff5db', '#b8e556'],
  ['BLOCK PARTY', 'LIVE MUSIC • CROWN HEIGHTS', '#f08664', '#301e45', '#684196'],
  ['EAST RIVER', 'KAYAK CLUB', '#c0e6f5', '#0d3757', '#37778b'],
  ['FLUSHING FLORA', 'PLANTS • POTS • SOIL', '#4f2c36', '#fbeaa2', '#83bd6e'],
  ['AFTER HOURS', 'DUMPLINGS • CHINATOWN', '#a8253a', '#fff4cf', '#e39c67'],
];

function drawMotif(ctx: CanvasRenderingContext2D, design: number) {
  switch (design % 7) {
    case 0:
      for (let i = 1; i <= 5; i++) {
        ctx.beginPath();
        ctx.ellipse(80, 85, 15 * i, 12 * i, -0.35, 0, Math.PI * 2);
        ctx.stroke();
      }

      break;
    case 1:
      for (let i = 0; i < 5; i++) ctx.fillRect(14 + i * 24, 75 - i * 12, 13, 83 + i * 12);
      break;
    case 2:
      ctx.beginPath();
      ctx.arc(76, 83, 55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(76, 83, 23, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(17, 80, 118, 6);
      break;
    case 3:
      for (let i = 0; i < 7; i++) {
        const dy = i * 12 + 31;

        ctx.beginPath();
        ctx.moveTo(7, dy);
        ctx.bezierCurveTo(44, dy + 43, 105, dy - 43, 143, dy);
        ctx.stroke();
      }

      break;
    case 4:
      ctx.translate(79, 82);

      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        ctx.fillRect(26, -3, 47 - (i % 2) * 15, 6);
      }

      break;
    case 5:
      for (let i = 0; i < 4; i++) {
        ctx.translate(18, 9);
        ctx.strokeRect(0, 16, 83, 96);
      }

      break;
    case 6:
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 118 + i * 12);
        ctx.lineTo(78, 21 + i * 12);
        ctx.lineTo(157, 118 + i * 12);
        ctx.stroke();
      }

      break;
  }
}

export function addPoster(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  index: number,
) {
  const design = index % posters.length;
  const [name, line, paper, ink, accent] = posters[design];
  const artOnLeft = design % 3 === 1;
  const textX = artOnLeft ? 167 : 25;
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
    ctx.translate(artOnLeft ? 2 : 353, h * 0.14);
    ctx.scale(1, h / 226);
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 5.5;
    drawMotif(ctx, design);
    ctx.restore();

    ctx.fillStyle = ink;

    ctx.font =
      design % 4 === 2 ? 'italic 900 62px Georgia, serif' : '900 61px system-ui, sans-serif';

    ctx.fillText(name, textX, h * 0.48, 321);

    if (design % 4 === 0) ctx.fillRect(textX, h * 0.55, 54, 3);

    ctx.font = 'bold 25px monospace';
    ctx.fillText(line, textX, h * 0.71, 310);
  });
  const mesh = new T.Mesh(
    new T.PlaneGeometry(width, height),
    new T.MeshBasicMaterial({ map, toneMapped: false }),
  );

  mesh.position.set(x, y, z);
  parent.add(mesh);
}
