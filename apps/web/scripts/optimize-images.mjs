import sharp from "sharp";
import { mkdir, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");

async function optimize() {
  const ogSrc = path.join(pub, "og.png");
  const iconSrc = path.join(pub, "icon.png");

  // OG social: JPEG (broad crawler support) + WebP for in-app/share UIs
  await sharp(ogSrc)
    .resize(1200, 630, { fit: "cover" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(pub, "og.jpg"));

  await sharp(ogSrc)
    .resize(1200, 630, { fit: "cover" })
    .webp({ quality: 80 })
    .toFile(path.join(pub, "og.webp"));

  // Compact PNG for platforms that insist on PNG (smaller than original)
  await sharp(ogSrc)
    .resize(1200, 630, { fit: "cover" })
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(pub, "og-1200.png"));

  // Landing / PWA-ish icons
  await sharp(iconSrc)
    .resize(128, 128)
    .webp({ quality: 85 })
    .toFile(path.join(pub, "icon-128.webp"));

  await sharp(iconSrc)
    .resize(64, 64)
    .webp({ quality: 85 })
    .toFile(path.join(pub, "icon-64.webp"));

  // Replace heavy og.png with optimized 1200 PNG
  await copyFile(path.join(pub, "og-1200.png"), ogSrc);

  for (const file of [
    "og.png",
    "og.jpg",
    "og.webp",
    "icon-128.webp",
    "icon-64.webp"
  ]) {
    const s = await stat(path.join(pub, file));
    console.log(`${file}: ${(s.size / 1024).toFixed(1)} KiB`);
  }
}

optimize().catch((err) => {
  console.error(err);
  process.exit(1);
});
