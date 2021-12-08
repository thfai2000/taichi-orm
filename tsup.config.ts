import { defineConfig } from 'tsup'
// import babel from 'esbuild-plugin-babel';

export default defineConfig({
    "platform": "node",
    "splitting": false,
    "sourcemap": true,
    "clean": true,
    "tsconfig": "./tsconfig.json",
    "target": "es2020"
})
