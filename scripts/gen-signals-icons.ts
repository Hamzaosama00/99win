/**
 * Generates the Signals PWA icons (192/512 PNG) from a vector design
 * using sharp. Run: bun scripts/gen-signals-icons.ts
 */
import sharp from 'sharp'
import path from 'node:path'

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#141a24"/>
      <stop offset="1" stop-color="#07090d"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe08a"/>
      <stop offset="1" stop-color="#f5b40a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <!-- signal waves -->
  <path d="M 96 340 A 170 170 0 0 1 416 340" fill="none" stroke="#e8114b" stroke-width="20" opacity="0.22" stroke-linecap="round"/>
  <path d="M 140 340 A 126 126 0 0 1 372 340" fill="none" stroke="#e8114b" stroke-width="20" opacity="0.45" stroke-linecap="round"/>
  <path d="M 184 340 A 82 82 0 0 1 328 340" fill="none" stroke="#e8114b" stroke-width="20" opacity="0.8" stroke-linecap="round"/>
  <!-- radar sweep plane -->
  <g transform="translate(256 236) rotate(-24)">
    <path d="M -110 18 L -20 -6 L 30 -6 L 96 -34 L 64 8 L 96 44 L 30 16 L -20 16 Z" fill="#e8114b"/>
    <path d="M -110 18 L -20 -6 L 30 -6 L 12 6 L -60 26 Z" fill="#b30c3b"/>
  </g>
  <!-- flight trail -->
  <path d="M 120 400 Q 220 380 300 330" fill="none" stroke="url(#gold)" stroke-width="14" stroke-linecap="round" stroke-dasharray="4 30"/>
  <circle cx="300" cy="330" r="14" fill="url(#gold)"/>
</svg>`

async function main() {
  const outDir = path.resolve(process.cwd(), 'public')
  for (const size of [192, 512]) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, `signals-icon-${size}.png`))
    console.log(`wrote public/signals-icon-${size}.png`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
