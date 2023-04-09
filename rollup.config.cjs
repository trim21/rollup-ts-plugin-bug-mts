const { getBabelOutputPlugin } = require('@rollup/plugin-babel')

const typescript = require('@rollup/plugin-typescript')
const replace = require('@rollup/plugin-replace')
const externals = require('rollup-plugin-node-externals')
const { nodeResolve } = require('@rollup/plugin-node-resolve')

const pkg = require('./package.json')

module.exports = {
  input: pkg.source,
  plugins: [
    nodeResolve({ extensions: ['.mjs', '.js', '.ts', '.mts', '.json', '.node'] }),
    getBabelOutputPlugin({ presets: ['@babel/preset-env'] }),
    externals({ builtinsPrefix: 'strip' }),
    typescript({
      tsconfig: 'tsconfig.json',
    }),
    replace({
      'process.env.MINIO_JS_PACKAGE_VERSION': JSON.stringify(pkg.version),
      preventAssignment: true,
    }),
  ],
  output: [
    // ES module (for bundlers) build.
    {
      format: 'esm',
      file: pkg.module,
      sourcemap: true,
      sourcemapExcludeSources: false,
    },
    // CommonJS (for Node) build.
    {
      format: 'cjs',
      file: pkg.main,
      sourcemap: true,
      sourcemapExcludeSources: false,
    },
  ],
}
