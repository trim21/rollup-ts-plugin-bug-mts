module.exports = {
  spec: 'src/test/**/*.mjs',
  exit: true,
  reporter: 'spec',
  ui: 'bdd',
  timeout: 5000,
  require: ['dotenv/config', 'source-map-support/register'],
  'node-option': ['experimental-specifier-resolution=node', 'loader=ts-node/esm'],
}
