/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import { beforeEach, describe, expect, it } from 'vitest';
import SandboxDeclaration from '../../src/Sandbox/SandboxDeclaration';

describe('SandboxDeclaration', () => {
    let declaration: SandboxDeclaration;

    beforeEach(() => {
        declaration = new SandboxDeclaration('my-sandbox');
    });

    describe('getName()', () => {
        it('should return the unique name of the sandbox', () => {
            expect(declaration.getName()).to.equal('my-sandbox');
        });
    });

    describe('getSandboxeeSpecs()', () => {
        it('should return an empty array initially', () => {
            expect(declaration.getSandboxeeSpecs()).to.have.length(0);
        });

        it('should return all added specs', () => {
            declaration.addSandboxeeSpec({
                src: '/path/to/first.js',
                onload: () => {},
                onerror: () => {},
            });
            declaration.addSandboxeeSpec({
                src: '/path/to/second.js',
                onload: () => {},
                onerror: () => {},
            });

            const specs = declaration.getSandboxeeSpecs();

            expect(specs).to.have.length(2);
            expect(specs[0].src).to.equal('/path/to/first.js');
            expect(specs[1].src).to.equal('/path/to/second.js');
        });
    });
});
