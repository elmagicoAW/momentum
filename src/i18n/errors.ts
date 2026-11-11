import type { MessageDescriptor, StaticMessageDescriptor } from '@/i18n/types';

/** Future presentation-boundary adapter only. Domain error types/control flow are not wrapped. */
export class PresentationError extends Error {
  readonly descriptor: MessageDescriptor;
  constructor(descriptor: MessageDescriptor) {
    super('Localized presentation error');
    this.name = 'PresentationError';
    // Cloning preserves the discriminated key/parameter pair; TS widens the spread union.
    this.descriptor = Object.freeze('params' in descriptor && descriptor.params
      ? { ...descriptor, params: Object.freeze({ ...descriptor.params }) } : { ...descriptor }) as MessageDescriptor;
  }
}
export function operationErrorMessage(operation: 'load' | 'save' | 'delete'): StaticMessageDescriptor {
  return Object.freeze({ key: `errors.${operation}` });
}
/** Unknown native messages may contain paths/user content; never echo or pattern-match them. */
export function errorMessage(error: unknown): MessageDescriptor {
  return error instanceof PresentationError ? error.descriptor : Object.freeze({ key: 'errors.unexpected' });
}
