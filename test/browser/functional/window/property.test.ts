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
    let writableWindow: WritableGlobalObject;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        writableWindow = window as unknown as WritableGlobalObject;
        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it('should allow window.event to be set', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            window.event = new window.Event('click');
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect((sandbox.getGlobal('event') as WritableObject).type).to.equal(
            'click',
        );
    });

    it('should allow properties to be set and fetched with a value of null', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            window.myProperty = null;
            
            window.myResult = (window.myProperty === null);
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myResult).to.be.undefined;
        expect(sandbox.getGlobal('myResult')).to.be.true;
    });

    it('should allow properties to be set and fetched with a value of undefined', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            window.myProperty = undefined;
            
            window.myResult = (window.myProperty === undefined);
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myResult).to.be.undefined;
        expect(sandbox.getGlobal('myResult')).to.be.true;
    });

    it('should allow method properties to be set and fetched that modify function arguments', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            window.myArgModifier = (aFunction) => {
                window.Object.defineProperty(aFunction, 'myNewProp', { value: 21 });
            };
            
            const myFunction = () => {};
            window.myArgModifier(myFunction);
            
            window.myResult = myFunction.myNewProp;
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myResult).to.be.undefined;
        expect(sandbox.getGlobal('myResult')).to.equal(21);
    });

    it('should allow array properties to be set and fetched that contain non-writable non-configurable properties', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            // Mapped template literals define such a property as ".raw".
            window.myArrayProperty = (t => t)\`hello\`;
            
            window.myResult = window.myArrayProperty.raw;
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myResult).to.be.undefined;
        expect(sandbox.getGlobal('myResult')).to.deep.equal(['hello']);
    });

    it('should fetch scalar values from the main window', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            window.myResult = {
                closed: closed,
                innerWidth: window.innerWidth,
            };
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myResult).to.be.undefined;
        expect(sandbox.getGlobal('myResult')).to.deep.equal({
            closed: false,
            innerWidth: window.innerWidth,
        });
    });
});
