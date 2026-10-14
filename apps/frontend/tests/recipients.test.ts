import { describe, expect, it } from 'vitest';
import { parseRecipients } from '../src/utils/recipients';
describe('recipient parsing', () => { it('supports CSV/text separators, deduplicates, and reports invalid values', () => { expect(parseRecipients('A@example.com, a@example.com\ninvalid; b@example.com')).toEqual({ valid: ['a@example.com', 'b@example.com'], invalid: ['invalid'] }); }); });
