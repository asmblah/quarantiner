/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from '@rollup/plugin-typescript';

export default [
    {
        input: 'src/quarantiner.ts',
        output: {
            file: 'dist/quarantiner.js',
            format: 'umd',
            name: 'quarantiner',
            sourcemap: true,
        },
        plugins: [
            // Support importing NPM packages.
            nodeResolve(),

            typescript({
                tsconfig: './tsconfig.json',
            })
        ],
    },
];
