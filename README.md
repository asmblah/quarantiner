# Quarantiner

[![Build Status](https://github.com/asmblah/quarantiner/workflows/CI/badge.svg)](https://github.com/asmblah/quarantiner/actions?query=workflow%3ACI)

[EXPERIMENTAL] Isolates scripts that may modify prototypes by running them inside an `<iframe>`.

## What is it?

This is **not** a security-focused sandbox. It is expected (for now) that a script
will be able to escape the sandbox if intentional.

The main purpose of this sandbox is to provide a _lightweight_ isolated script environment
so that incompatible or badly-behaving scripts that modify global objects
or global prototypes can be isolated enough from each other to function together.

## Recommended usage

It is recommended that you use this alongside a bundler,
e.g. via the [Rollup plugin rollup-plugin-sandbox][rollup-plugin-sandbox].

## Alternative usage (if requiring directly)

```shell
$ npm i quarantiner
```

### Global API

A global object `quarantiner` will be installed, which is actually defined by the UMD build for this library.

#### Methods of the `quarantiner` global:

- `quarantiner.quarantine(...)`:
    ```
    quarantiner.quarantine(
        wrapper: WrapperFunction,
        config: ConfigOptions = { globals: {}, sandbox: 'default' }
    ): Promise<void>
    ```
  - `wrapper`: a function that defines a script to be executed inside the sandbox.
  - `config`: an optional configuration object:
    - `config.globals`: globals that are expected to be defined by the script,
                        that should then be defined as globals on the main window/global object.
                        Example: `{ myGlobal: { type: 'function' } }`
    - `config.sandbox`: name of the sandbox to execute the script inside.
                        any scripts that specify the same sandbox name
                        will be run inside the same sandbox.

- `quarantiner.getSandbox(name: string = 'default'): Promise<Sandbox>`:
   Allows fetching the `Sandbox` instance for a declared sandbox.

## See also
- [rollup-plugin-sandbox][rollup-plugin-sandbox], a [Rollup][Rollup] plugin which uses this library.

[Rollup]: https://rollupjs.org/
[rollup-plugin-sandbox]: https://github.com/asmblah/rollup-plugin-sandbox
