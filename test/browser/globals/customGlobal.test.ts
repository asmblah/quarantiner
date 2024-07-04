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

describe('Custom globals handling', () => {
    let quarantiner: UmdGlobal;
    let writableWindow: WritableGlobalObject;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        writableWindow = window as unknown as WritableGlobalObject;
        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it('custom globals assigned to the window should not affect the main window', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            window.myCustomGlobalOnWindow = 21;
            self.myCustomGlobalOnSelf = 22;
            parent.myCustomGlobalOnParent = 23;
            top.myCustomGlobalOnTop = 24;
        });
        `);
        const sandbox = await quarantiner.getSandbox();
        await sandbox.getPendingSandboxeePromise(); // Wait for the script above to be re-executed inside the sandbox.

        expect(writableWindow.myCustomGlobalOnWindow).to.be.undefined;
        expect(writableWindow.myCustomGlobalOnSelf).to.be.undefined;
        expect(writableWindow.myCustomGlobalOnParent).to.be.undefined;
        expect(writableWindow.myCustomGlobalOnTop).to.be.undefined;
        expect(sandbox.getGlobal('myCustomGlobalOnWindow')).to.equal(21);
        expect(sandbox.getGlobal('myCustomGlobalOnSelf')).to.equal(22);
        expect(sandbox.getGlobal('myCustomGlobalOnParent')).to.equal(23);
        expect(sandbox.getGlobal('myCustomGlobalOnTop')).to.equal(24);
    });
});
