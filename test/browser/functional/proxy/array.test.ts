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

describe('Proxy Array handling', () => {
    let quarantiner: UmdGlobal;
    let writableWindow: WritableGlobalObject;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        writableWindow = window as unknown as WritableGlobalObject;
        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it('should allow array properties to be fetched that contain non-writable non-configurable properties', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            const div = window.document.createElement('div');
            window.document.body.appendChild(div);
            
            const myArray = ['one', 'two'];
            
            // Deliberately use Object and not window.Object to ensure unhooked Object.defineProperty(...) use.
            Object.defineProperty(myArray, 'myProp', {
                configurable: false,
                writable: false,
                value: 'my value'
            });
            
            div.myArray = myArray;
            
            window.myResult = div.myArray.myProp;
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(sandbox.getGlobal('myResult')).to.equal('my value');
    });

    it('should return true for Array.isArray(...) of array properties', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            const div = window.document.createElement('div');
            window.document.body.appendChild(div);
            
            div.myArray = ['one', 'two'];
            
            window.myResult = Array.isArray(div.myArray);
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(sandbox.getGlobal('myResult')).to.be.true;
    });

    it('should proxy DOM nodes when converted from a NodeList with Array.from(...)', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            const div = window.document.createElement('div');
            div.id = 'myDiv';
            window.document.body.appendChild(div);
            
            const nodeList = window.document.querySelectorAll('#myDiv');
            
            window.Array.from(nodeList)[0].ownerDocument.defaultView.myValue = 101;
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myValue).to.be.undefined;
        expect(sandbox.getGlobal('myValue')).to.equal(101);
    });
});
