# `@math-visuals/core`

Shared runtime utilities and the application contract for Math Visuals packages.

## Getting started

Install dependencies and build the package:

```bash
npm install
npm run build:packages
```

Inside another package or application that is part of the workspace you can import the
helpers directly:

```js
import { defineMathVisualApp, createAppHost } from '@math-visuals/core';
```

## Defining an app

```js
import { defineMathVisualApp } from '@math-visuals/core';

export const counterApp = defineMathVisualApp({
  id: 'counter-demo',
  title: 'Counter',
  metadata: { category: 'examples' },
  create({ bus }) {
    let value = 0;

    return {
      mount(target) {
        target.textContent = String(value);
      },
      update(delta) {
        value += delta;
        bus.emit('counter:update', value);
      },
      unmount() {
        value = 0;
      }
    };
  }
});
```

## Hosting an app

```js
import { createAppHost } from '@math-visuals/core';
import { counterApp } from './counter-app.js';

const host = createAppHost();
const container = document.querySelector('#mount');

const instance = host.mount(counterApp, { target: container });
instance.update(1);
```
