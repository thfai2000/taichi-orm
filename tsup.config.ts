import { defineConfig } from 'tsup'
// import babel from 'esbuild-plugin-babel';

export default defineConfig({
    "platform": "node",
    "splitting": false,
    "sourcemap": true,
    "clean": true,
    "tsconfig": "./tsconfig.json",
    //@ts-ignore
    // esbuildPlugins: [babel({
    //     config: {
    //         "presets": ["@babel/preset-typescript"],
    //         "plugins": ["babel-plugin-macros", "@babel/plugin-transform-modules-commonjs"]
    //     }
    // })]
})
