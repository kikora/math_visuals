# Shared package workspace

This repository now exposes a small npm workspace to manage shared packages that
can be reused across the Math Visuals projects. The first package available is
`@math-visuals/core`, which contains the application contract, lifecycle host and
support utilities such as the event bus implementation.

## Installation

Run the usual install command from the repository root. npm will detect the
workspace configuration and hoist dependencies where possible:

```bash
npm install
```

## Building packages

Packages that live under `packages/` provide their own Rollup configuration.
From the project root you can build every package at once using:

```bash
npm run build:packages
```

You can also build a single package when iterating locally:

```bash
npm run build --workspace @math-visuals/core
```

The generated bundles are written to each package's `dist/` folder as both ESM
and CommonJS modules so they can be consumed in a variety of runtimes.

## Consuming packages

Because the workspace shares the `node_modules` folder at the root, any code in
this repository can import the packages directly by name:

```js
import { createAppHost } from '@math-visuals/core';
```

When publishing or linking the package from another project, the `files`
configuration ensures that only the `dist/` folder is exposed to consumers.
