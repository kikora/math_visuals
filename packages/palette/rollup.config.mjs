import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
);

const external = [
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.peerDependencies || {})
];

export default {
  input: path.join(__dirname, 'src/index.js'),
  output: [
    {
      file: path.join(__dirname, 'dist/index.js'),
      format: 'esm',
      sourcemap: true
    },
    {
      file: path.join(__dirname, 'dist/index.cjs'),
      format: 'cjs',
      exports: 'named',
      sourcemap: true
    },
    {
      file: path.join(__dirname, 'dist/index.global.js'),
      format: 'iife',
      name: 'MathVisualsPalettePackage',
      sourcemap: true
    }
  ],
  external,
  plugins: [
    nodeResolve({
      preferBuiltins: true
    }),
    commonjs()
  ]
};
