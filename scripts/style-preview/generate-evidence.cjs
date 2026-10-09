// Small, entirely synthetic files for inspecting the real IGV/CNR components.
const fs = require('node:fs');
const path = require('node:path');
const directory = path.join(process.cwd(), '.gotmp/style-preview-evidence');
fs.mkdirSync(directory, { recursive: true });
let fasta = '', index = '';
for (const [name, length] of [['chr1', 300000], ['chrM', 16569]]) {
  fasta += `>${name}\n`;
  index += `${name}\t${length}\t${Buffer.byteLength(fasta)}\t60\t61\n`;
  const sequence = 'ACGT'.repeat(Math.ceil(length / 4)).slice(0, length);
  for (let start = 0; start < length; start += 60) fasta += sequence.slice(start, start + 60) + '\n';
}
fs.writeFileSync(path.join(directory, 'reference.fa'), fasta);
fs.writeFileSync(path.join(directory, 'reference.fa.fai'), index);
fs.writeFileSync(path.join(directory, 'genes.gff3'), '##gff-version 3\nchr1\tpreview\tgene\t99500\t105000\t.\t+\t.\tID=synthetic-gene;Name=SYNTHETIC_GENE\nchrM\tpreview\tgene\t3100\t3500\t.\t+\t.\tID=synthetic-mt;Name=SYNTHETIC_MT\n');
fs.writeFileSync(path.join(directory, 'signals.cnr'), 'chromosome\tstart\tend\tgene\tlog2\tweight\n' + Array.from({ length: 12 }, (_, i) => `chr1\t${100000 + i * 1000}\t${100500 + i * 1000}\tBRCA1|NM_001000|SYNTHETIC|${i + 1}|+|demo\t${i < 5 ? -1 : i < 9 ? 0 : 0.585}\t1`).join('\n') + '\n');
