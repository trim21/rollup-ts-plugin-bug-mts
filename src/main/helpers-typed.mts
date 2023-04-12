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

// All characters in string which are NOT unreserved should be percent encoded.
// Unreserved characers are : ALPHA / DIGIT / "-" / "." / "_" / "~"
// Reference https://tools.ietf.org/html/rfc3986#section-2.2
export function uriEscape(s: string): string {
  return s.split('').reduce((acc, elem) => {
    let buf = Buffer.from(elem)
    if (buf.length === 1) {
      // length 1 indicates that elem is not a unicode character.
      // Check if it is an unreserved characer.
      if (
        ('A' <= elem && elem <= 'Z') ||
        ('a' <= elem && elem <= 'z') ||
        ('0' <= elem && elem <= '9') ||
        elem === '_' ||
        elem === '.' ||
        elem === '~' ||
        elem === '-'
      ) {
        // Unreserved characer should not be encoded.
        acc = acc + elem
        return acc
      }
    }
    // elem needs encoding - i.e elem should be encoded if it's not unreserved
    // character or if it's a unicode character.
    for (let i = 0; i < buf.length; i++) {
      acc = acc + '%' + buf[i].toString(16).toUpperCase()
    }
    return acc
  }, '')
}

export function uriResourceEscape(s: string): string {
  return uriEscape(s).replace(/%2F/g, '/')
}

export function getScope(region: string, date?: Date, serviceName = 's3') {
  return `${makeDateShort(date)}/${region}/${serviceName}/aws4_request`
}
