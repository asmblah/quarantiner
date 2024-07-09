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

describe('DOM Element handling', () => {
    let quarantiner: UmdGlobal;
    let writableWindow: WritableGlobalObject;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        writableWindow = window as unknown as WritableGlobalObject;
        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it("should use the main window's document", async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            var div = window.document.createElement('div');
            div.id = 'myDiv';
            div.textContent = 'Hello!';
            
            window.document.body.appendChild(div);
        });
        `);
        await quarantiner.getSandbox(); // Wait for the script above to be re-executed inside the sandbox.
        const div = document.getElementById('myDiv');

        expect(div).to.be.an.instanceOf(HTMLDivElement);
        expect(div?.textContent).to.equal('Hello!');
    });

    it('should handle .appendChild(...) correctly', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            var div1 = window.document.createElement('div');
            div1.id = 'myFirstDiv';
            div1.textContent = 'Hello!';
            
            var div2 = window.document.createElement('div');
            div2.id = 'mySecondDiv';
            div2.textContent = 'Goodbye!';
            
            div1.appendChild(div2);
            window.document.body.appendChild(div1);
        });
        `);
        await quarantiner.getSandbox(); // Wait for the script above to be re-executed inside the sandbox.
        const div = document.getElementById('myFirstDiv');

        expect(div).to.be.an.instanceOf(HTMLDivElement);
        expect(div?.id).to.equal('myFirstDiv');
        expect(div?.children[0]).to.be.an.instanceOf(HTMLDivElement);
        expect(div?.children[0].id).to.equal('mySecondDiv');
    });

    it('should return the sandbox window for element.ownerDocument.defaultView', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            var div = window.document.createElement('div');
            window.document.body.appendChild(div);
            
            div.ownerDocument.defaultView.myValue = 101;
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myValue).to.be.undefined;
        expect(sandbox.getGlobal('myValue')).to.equal(101);
    });
});
