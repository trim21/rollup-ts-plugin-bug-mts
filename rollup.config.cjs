const typescript = require('@rollup/plugin-typescript')
const externals = require('rollup-plugin-node-externals')
const { nodeResolve } = require('@rollup/plugin-node-resolve')

const pkg = require('./package.json')

module.exports = {
  input: './index.mjs',
  plugins: [
    nodeResolve({ extensions: ['.mjs', '.js', '.ts', '.mts', '.json', '.node'] }),
    externals({ builtinsPrefix: 'strip' }),
    typescript({
      include: ['*.ts', '*.mts', '*.cts'],
      tsconfig: 'tsconfig.json',
    }),
  ],
  output: [
    // ES module (for bundlers) build.
    {
      format: 'esm',
      file: './dist/esm.mjs'
    },
  ],
}
