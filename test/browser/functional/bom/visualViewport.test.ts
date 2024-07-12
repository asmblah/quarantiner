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

describe('BOM .visualViewport handling', () => {
    let quarantiner: UmdGlobal;
    let writableWindow: WritableGlobalObject;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        writableWindow = window as unknown as WritableGlobalObject;
        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it('should return the main window extents for window.visualViewport', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            const visualViewport = window.visualViewport;
            
            window.myResult = {
                offsetLeft: visualViewport.offsetLeft,
                offsetTop: visualViewport.offsetTop,
                pageLeft: visualViewport.pageLeft,
                pageTop: visualViewport.pageTop,
                width: visualViewport.width,
                height: visualViewport.height,
                scale: visualViewport.scale,
            };
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myResult).to.be.undefined;
        expect(sandbox.getGlobal('myResult')).to.deep.equal({
            offsetLeft: window.visualViewport?.offsetLeft,
            offsetTop: window.visualViewport?.offsetTop,
            pageLeft: window.visualViewport?.pageLeft,
            pageTop: window.visualViewport?.pageTop,
            width: window.visualViewport?.width,
            height: window.visualViewport?.height,
            scale: window.visualViewport?.scale,
        });
    });
});
