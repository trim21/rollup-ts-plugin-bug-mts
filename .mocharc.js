module.exports = {
  spec: 'src/test/**/*.mjs',
  exit: true,
  reporter: 'spec',
  ui: 'bdd',
  require: ['dotenv/config', 'source-map-support/register'],
  'node-option': ['experimental-specifier-resolution=node', 'loader=ts-node/esm'],
}
