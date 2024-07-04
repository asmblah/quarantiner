/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import babel from '@rollup/plugin-babel';
import { copyFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import typescript from '@rollup/plugin-typescript';

export default defineConfig(({ mode }) => ({
    build: {
        lib: {
            entry: resolve('./src/quarantiner.ts'),
            formats: ['umd'],
            name: 'quarantiner',
        },
        minify: mode === 'development' ? false : 'terser',
        rollupOptions: {
            plugins: [
                typescript(),

                {
                    name: 'umd-declarations',
                    closeBundle: (): void => {
                        // Ensure types are also available for the UMD bundle itself.
                        copyFileSync(
                            import.meta.dirname + '/dist/quarantiner.d.ts',
                            import.meta.dirname + '/dist/quarantiner.umd.d.ts',
                        );
                    },
                },

                babel({
                    babelHelpers: 'runtime',
                    extensions: ['.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx'],
                    // Ensure we don't transpile node_modules,
                    // or at least exclude core-js itself to avoid circular dependencies.
                    include: ['src/**'],
                }),
            ],
        },
        sourcemap: true,
    },

    test: {
        workspace: 'vitest.workspace.mts',
    },
}));
