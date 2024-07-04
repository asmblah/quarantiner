/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { loadJsAsScript, loadScript } from '../../harness/tools';

describe('Array.prototype isolation', () => {
    let quarantiner: UmdGlobal;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it("modifying Array.prototype should not affect the main window's Array.prototype", async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            window.Array.prototype.myValue = 21;
        });
        `);
        const sandbox = await quarantiner.getSandbox();
        await sandbox.getPendingSandboxeePromise(); // Wait for the script above to be re-executed inside the sandbox.

        type ArrayConstructor = { prototype: { myValue: number } };

        expect((window.Array as unknown as ArrayConstructor).prototype.myValue)
            .to.be.undefined;
        expect(
            (sandbox.getGlobal('Array') as ArrayConstructor).prototype.myValue,
        ).to.equal(21);
    });
});
