const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function parseRecipients(text: string) { const values = text.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean); const unique = [...new Set(values)]; return { valid: unique.filter((x) => emailPattern.test(x)), invalid: unique.filter((x) => !emailPattern.test(x)) }; }
