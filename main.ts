// VERANO HEAT — hand-in program for the gta6-01 entry (Node 22, stdlib only).
// What it does, plainly: take the finished game in ./game and the four
// screenshots in ./screenshots, copy both into the output folder, and write
// dossier.json there using buildDossier from the vendored make.fun library.
// The caps passed below mirror the scorer's own limits, so a local run fails
// loudly on anything the real gate would refuse (too many game files, an
// oversized screenshot, and so on) instead of failing silently later.
// Run it locally with:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (Without MAKEFUN_OUTPUT_DIR it writes to /output, as in the grader.)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output folders for the two payloads, then copy them across verbatim.
mkdirSync(join(outputDir, 'game'), { recursive: true });
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Finally, the dossier the judge reads — source text capped at 160 KiB,
// screenshots at 4 files / 256 KiB each, game tree at 993 entries / 48 MiB.
const dossierBytes = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierBytes);
