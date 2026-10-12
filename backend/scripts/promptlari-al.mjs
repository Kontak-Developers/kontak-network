// ../prompts/{analiz,uretim,haftalik}.md → src/promptlar.gen.ts
// wrangler [build] her dev/deploy öncesi çalıştırır. Nida promptu
// değiştirince kod değişmeden yeni hali derlemeye girer.
// Dosya yoksa alan undefined kalır, brain.ts yerleşik varsayılanı kullanır.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const promptlar = join(kok, '..', 'prompts');
const cikti = {};
for (const ad of ['analiz', 'uretim', 'haftalik']) {
  const yol = join(promptlar, `${ad}.md`);
  if (existsSync(yol)) cikti[ad] = readFileSync(yol, 'utf8');
}
const hedef = join(kok, 'src', 'promptlar.gen.ts');
const yeni =
  `// OTOMATİK ÜRETİLDİ (scripts/promptlari-al.mjs). Elle düzenleme.\n` +
  `export const PROMPTLAR: Record<string, string | undefined> = ${JSON.stringify(cikti, null, 2)};\n`;
// Değişmediyse yazma: wrangler dev gereksiz yeniden başlamasın.
if (!existsSync(hedef) || readFileSync(hedef, 'utf8') !== yeni) writeFileSync(hedef, yeni);
console.log(`promptlar: ${Object.keys(cikti).join(', ') || '(yok, varsayılanlar)'}`);
