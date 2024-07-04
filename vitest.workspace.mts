/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
    {
        extends: './vite.config.mts',
        publicDir: './dist', // Make built assets available during tests.
        test: {
            name: 'browser',
            include: ['test/browser/**/*.test.ts'],
            browser: {
                enabled: true,
                name: 'firefox',
                provider: 'playwright',
            },
        },
    },
    {
        extends: './vite.config.mts',
        test: {
            name: 'node',
            include: ['test/{integrated,unit}/**/*.test.ts'],
        },
    },
]);
