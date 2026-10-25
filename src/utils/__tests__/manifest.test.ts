import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../../manifest.json';

describe('manifest', () => {
    it('exposes no page or asset to websites', () => {
        // A web-accessible index.html can be framed by any site (clickjacking) and shows that TabPlex is installed
        expect(manifest).not.toHaveProperty('web_accessible_resources');
    });

    it('has no always-on site access and no way in for websites or other extensions', () => {
        expect(manifest).not.toHaveProperty('host_permissions');
        expect(manifest).not.toHaveProperty('content_scripts');
        expect(manifest).not.toHaveProperty('externally_connectable');
    });
});

describe('permission documentation', () => {
    // CLAUDE.md: every permission must be justified in the privacy policy, the README and the store listing
    const read = (file: string) => readFileSync(resolve(__dirname, '../../../', file), 'utf8');
    const docs = {
        'PRIVACY.md': read('PRIVACY.md'),
        'README.md': read('README.md'),
        'CHROMEWEBSTORE.md': read('CHROMEWEBSTORE.md'),
    };

    it.each(manifest.permissions)('%s is explained in every document', permission => {
        for (const [name, text] of Object.entries(docs)) {
            expect(text, `${name} should mention the "${permission}" permission`).toContain(`\`${permission}\``);
        }
    });

    it('asks for the alarms permission (the daily cleanup needs it)', () => {
        expect(manifest.permissions).toContain('alarms');
    });
});
