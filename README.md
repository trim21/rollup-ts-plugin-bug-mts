# step to build

```shell
git clone --depth=1 https://github.com/trim21/rollup-ts-plugin-bug-mts rollup-ts-plugin-bug-mts
cd rollup-ts-plugin-bug-mts
npm i
npm run build
```

```text
❯❯ ~\..\rollup-ts-plugin-bug-mts git:(refactor-client) yarn build
yarn run v1.22.19
$ rimraf ./dist/
$ rollup -c rollup.config.cjs

./index.mjs → ./dist/esm.mjs...
(!) Plugin typescript: @rollup/plugin-typescript TS5096: Option 'allowImportingTsExtensions' can only be used when either 'noEmit' or 'emitDeclarationOnly' is set.
[!] RollupError: Unexpected token (Note that you need plugins to import files that are not JavaScript)
src/can-not-import.mts (1:17)
1: export const name: string = "can-not-import-2"
```
