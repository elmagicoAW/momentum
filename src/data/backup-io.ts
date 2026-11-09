import { LIMITS } from '@/data/backup-format';

/** Enforce a byte bound even when the provider supplies no size (or lies). */
export async function boundedText(stream: ReadableStream<Uint8Array>, limit = LIMITS.file): Promise<string> {
  const reader = stream.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('Backup exceeds the 8 MiB file limit');
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export async function pickedText<T>(pick: () => Promise<{ canceled: true } | { canceled: false; result: T }>, read: (file: T) => Promise<string>) {
  const result = await pick();
  return result.canceled ? null : read(result.result);
}
