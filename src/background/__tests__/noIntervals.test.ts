import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The service worker sleeps after about 30 seconds, so a setInterval in it never reaches a period of minutes or
// days. Periodic work belongs in a chrome.alarms alarm (see cleanup-service.ts and session-service.ts).
describe('background code', () => {
    const dir = resolve(__dirname, '..');
    const files = readdirSync(dir).filter(name => name.endsWith('.ts'));

    it('has files to check', () => {
        expect(files.length).toBeGreaterThan(10);
    });

    it.each(files)('%s does not use setInterval', name => {
        const code = readFileSync(resolve(dir, name), 'utf8')
            .split('\n')
            .filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
            .join('\n');
        expect(code).not.toMatch(/\bsetInterval\s*\(/);
    });
});
