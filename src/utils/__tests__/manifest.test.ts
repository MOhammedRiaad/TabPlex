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
