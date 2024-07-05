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

describe('Proxied declared globals handling', () => {
    let quarantiner: UmdGlobal;
    let writableWindow: WritableGlobalObject;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        writableWindow = window as unknown as WritableGlobalObject;
        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it('should synchronously define globals declared by the config', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            window.myGlobal = function () {
                return 'my result';
            };
        }, {globals: {myGlobal: {type: 'function'}}});
        
        window.myResult = typeof window.myGlobal;
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        await quarantiner.getSandbox();

        expect(writableWindow.myResult).to.equal('function');
    });

    it.skip(
        'should replay any calls made before the sandbox was fully initialised',
    );
});
