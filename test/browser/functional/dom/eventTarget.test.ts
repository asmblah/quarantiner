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

describe('DOM EventTarget handling', () => {
    let quarantiner: UmdGlobal;
    let writableWindow: WritableGlobalObject;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        writableWindow = window as unknown as WritableGlobalObject;
        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it('should correctly proxy the Event argument passed to event listeners', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            var div = window.document.createElement('div');
            div.id = 'myDiv';
            
            div.addEventListener('click', (event) => {
                event.target.ownerDocument.defaultView.myResult = 'my result';
            });
            
            window.document.body.appendChild(div);
            
            div.click();
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myResult).to.be.undefined;
        expect(sandbox.getGlobal('myResult')).to.equal('my result');
    });

    it('should always return the same proxy for the .addEventListener(...) method itself', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            var div = window.document.createElement('div');

            window.myResult = {
                type: typeof div.addEventListener,
                identical: div.addEventListener === window.document.addEventListener
            };
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myResult).to.be.undefined;
        expect(sandbox.getGlobal('myResult')).to.deep.equal({
            type: 'function',
            identical: true,
        });
    });

    it('should support .removeEventListener(...)', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            var div1 = window.document.createElement('div');
            var div2 = window.document.createElement('div');
            
            const firstHandler = (event) => {
                event.target.ownerDocument.defaultView.myFirstResult = 'my first result';
            };
            const secondHandler = (event) => {
                event.target.ownerDocument.defaultView.mySecondResult = 'my second result';
            };
            
            div1.addEventListener('click', firstHandler);
            div2.addEventListener('click', secondHandler);
            
            window.document.body.appendChild(div1);
            window.document.body.appendChild(div2);
            
            div1.removeEventListener('click', firstHandler);
            
            div1.click();
            div2.click();
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myFirstResult).to.be.undefined;
        expect(writableWindow.mySecondResult).to.be.undefined;
        expect(sandbox.getGlobal('myFirstResult')).to.be.undefined; // As handler was removed.
        expect(sandbox.getGlobal('mySecondResult')).to.equal(
            'my second result',
        );
    });
});
