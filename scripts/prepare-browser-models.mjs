import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname } from 'node:path';
const models = [
  ['Xenova/all-MiniLM-L6-v2', ['config.json', 'tokenizer_config.json', 'tokenizer.json', 'special_tokens_map.json', 'onnx/model_quantized.onnx']],
  ['Xenova/clip-vit-base-patch32', ['config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'onnx/vision_model_quantized.onnx', 'onnx/text_model_quantized.onnx']],
];
for (const [model, files] of models) for (const file of files) {
  const path = new URL(`../public/models/${model}/${file}`, import.meta.url);
  try { await access(path); console.log(`Already present: ${model}/${file}`); continue; } catch {}
  const response = await fetch(`https://huggingface.co/${model}/resolve/main/${file}`, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`${model}/${file}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await mkdir(dirname(path.pathname.replace(/^\/([A-Za-z]:)/, '$1')), { recursive: true });
  await writeFile(path, bytes);
  console.log(`Prepared ${model}/${file}: ${(bytes.length / 1024 / 1024).toFixed(1)} MB`);
}
