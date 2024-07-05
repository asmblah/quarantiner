/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { loadJsAsScript, loadScript } from 'buildbelt';

describe('Window property handling', () => {
    let quarantiner: UmdGlobal;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it('should allow window.event to be set', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            window.event = new Event('click');
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect((sandbox.getGlobal('event') as WritableObject).type).to.equal(
            'click',
        );
    });
});
