import { IncomingHttpHeaders } from 'http'
import stream, { Duplex } from 'stream'

export function getVersionId(headers: IncomingHttpHeaders = {}) {
  const versionIdValue = headers['x-amz-version-id']
  return versionIdValue || null
}

export function getSourceVersionId(headers: IncomingHttpHeaders = {}) {
  const sourceVersionId = headers['x-amz-copy-source-version-id']
  return sourceVersionId || null
}

const replaceChars: Record<string, string> = { '"': '', '&quot;': '', '&#34;': '', '&QUOT;': '', '&#x00022': '' }

export function sanitizeETag(etag = ''): string {
  return etag.replace(/^("|&quot;|&#34;)|("|&quot;|&#34;)$/g, (m) => replaceChars[m])
}

export function pipesetup(...streams: Duplex[]) {
  return streams.reduce((src, dst) => {
    src.on('error', (err: unknown) => dst.emit('error', err))
    return src.pipe(dst)
  })
}

export function readableStream(data: any): stream.Readable {
  const s = new stream.Readable()
  s._read = () => {}
  s.push(data)
  s.push(null)
  return s
}

// Create a Date string with format:
// 'YYYYMMDDTHHmmss' + Z
export function makeDateLong(date?: Date): string {
  date = date || new Date()

  // Gives format like: '2017-08-07T16:28:59.889Z'
  const s = date.toISOString()

  return s.slice(0, 4) + s.slice(5, 7) + s.slice(8, 13) + s.slice(14, 16) + s.slice(17, 19) + 'Z'
}

// Create a Date string with format:
// 'YYYYMMDD'
export function makeDateShort(date?: Date): string {
  date = date || new Date()

  // Gives format like: '2017-08-07T16:28:59.889Z'
  const s = date.toISOString()

  return s.slice(0, 4) + s.slice(5, 7) + s.slice(8, 10)
}
