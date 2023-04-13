// fix missing @types/json-stream
import * as stream from 'node:stream'

export default class BlockStream2 extends stream.Transform {
  constructor(options: { size: number; zeroPadding: boolean })
}
