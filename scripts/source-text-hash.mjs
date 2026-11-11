import { createHash } from 'node:crypto';

/** Text-source identity across Git checkouts. Preserve all content except CRLF versus LF. */
export function sourceTextHash(text) {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}
