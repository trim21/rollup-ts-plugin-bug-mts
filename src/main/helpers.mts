/*
 * MinIO Javascript Library for Amazon S3 Compatible Cloud Storage, (C) 2015 MinIO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as Crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as stream from 'node:stream'

import { isBrowser } from 'browser-or-node'
import { XMLParser } from 'fast-xml-parser'
import type { IncomingHttpHeaders } from 'http'
import ipaddr from 'ipaddr.js'
import _ from 'lodash'
import mime from 'mime-types'
import querystring from 'query-string'
import type { Readable as ReadableStream } from 'stream'

import * as errors from './errors.mts'
import type { Binary } from './type.ts'

export type MetaData = Record<string, string>
export type Header = Record<string, string | null | undefined>

const fxp = new XMLParser()

// All characters in string which are NOT unreserved should be percent encoded.
// Unreserved characers are : ALPHA / DIGIT / "-" / "." / "_" / "~"
// Reference https://tools.ietf.org/html/rfc3986#section-2.2
export function uriEscape(string: string) {
  return string.split('').reduce((acc: string, elem: string) => {
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

export function uriResourceEscape(string: string) {
  return uriEscape(string).replace(/%2F/g, '/')
}

export function getScope(region: string, date: Date, serviceName = 's3') {
  return `${makeDateShort(date)}/${region}/${serviceName}/aws4_request`
}

// isAmazonEndpoint - true if endpoint is 's3.amazonaws.com' or 's3.cn-north-1.amazonaws.com.cn'
export function isAmazonEndpoint(endpoint: string) {
  return endpoint === 's3.amazonaws.com' || endpoint === 's3.cn-north-1.amazonaws.com.cn'
}

// isVirtualHostStyle - verify if bucket name is support with virtual
// hosts. bucketNames with periods should be always treated as path
// style if the protocol is 'https:', this is due to SSL wildcard
// limitation. For all other buckets and Amazon S3 endpoint we will
// default to virtual host style.
export function isVirtualHostStyle(endpoint: string, protocol: string, bucket: string, pathStyle: boolean) {
  if (protocol === 'https:' && bucket.indexOf('.') > -1) {
    return false
  }
  return isAmazonEndpoint(endpoint) || !pathStyle
}

export function isValidIP(ip: string) {
  return ipaddr.isValid(ip)
}

// isValidEndpoint - true if endpoint is valid domain.
export function isValidEndpoint(endpoint: string) {
  return isValidDomain(endpoint) || isValidIP(endpoint)
}

// isValidDomain - true if input host is a valid domain.
export function isValidDomain(host: string) {
  if (!isString(host)) {
    return false
  }
  // See RFC 1035, RFC 3696.
  if (host.length === 0 || host.length > 255) {
    return false
  }
  // Host cannot start or end with a '-'
  if (host[0] === '-' || host.slice(-1) === '-') {
    return false
  }
  // Host cannot start or end with a '_'
  if (host[0] === '_' || host.slice(-1) === '_') {
    return false
  }
  // Host cannot start with a '.'
  if (host[0] === '.') {
    return false
  }
  let alphaNumerics = '`~!@#$%^&*()+={}[]|\\"\';:><?/'.split('')
  // All non alphanumeric characters are invalid.
  for (let i in alphaNumerics) {
    if (host.indexOf(alphaNumerics[i]) > -1) {
      return false
    }
  }
  // No need to regexp match, since the list is non-exhaustive.
  // We let it be valid and fail later.
  return true
}

// Probes contentType using file extensions.
// For example: probeContentType('file.png') returns 'image/png'.
export function probeContentType(path: string) {
  let contentType = mime.lookup(path)
  if (!contentType) {
    contentType = 'application/octet-stream'
  }
  return contentType
}

// isValidPort - is input port valid.
export function isValidPort(port: unknown): port is number {
  // verify if port is a number.
  if (!isNumber(port)) {
    return false
  }
  // port cannot be negative.
  if (port < 0) {
    return false
  }
  // port '0' is valid and special case return true.
  if (port === 0) {
    return true
  }
  let min_port = 1
  let max_port = 65535
  // Verify if port is in range.
  return port >= min_port && port <= max_port
}

export function isValidBucketName(bucket: any) {
  if (!isString(bucket)) {
    return false
  }

  // bucket length should be less than and no more than 63
  // characters long.
  if (bucket.length < 3 || bucket.length > 63) {
    return false
  }
  // bucket with successive periods is invalid.
  if (bucket.indexOf('..') > -1) {
    return false
  }
  // bucket cannot have ip address style.
  if (bucket.match(/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/)) {
    return false
  }
  // bucket should begin with alphabet/number and end with alphabet/number,
  // with alphabet/number/.- in the middle.
  if (bucket.match(/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/)) {
    return true
  }
  return false
}

// check if objectName is a valid object name
export function isValidObjectName(objectName: any) {
  if (!isValidPrefix(objectName)) {
    return false
  }
  if (objectName.length === 0) {
    return false
  }
  return true
}

// check if prefix is valid
export function isValidPrefix(prefix: any) {
  if (!isString(prefix)) {
    return false
  }
  if (prefix.length > 1024) {
    return false
  }
  return true
}

// check if typeof arg number
export function isNumber(arg: unknown): arg is number {
  return typeof arg === 'number'
}

// check if typeof arg function
export function isFunction(arg: unknown): arg is () => unknown {
  return typeof arg === 'function'
}

// check if typeof arg string
export function isString(arg: unknown): arg is string {
  return typeof arg === 'string'
}

// check if typeof arg object
export function isObject(arg: unknown): arg is object {
  return typeof arg === 'object' && arg !== null
}

// check if object is readable stream
export function isReadableStream(arg: unknown): arg is ReadableStream {
  // @ts-expect-error ._read prop
  return isObject(arg) && isFunction(arg._read)
}

// check if arg is boolean
export function isBoolean(arg: unknown): arg is boolean {
  return typeof arg === 'boolean'
}

// check if arg is array
export function isArray(arg: unknown): arg is Array<unknown> {
  return Array.isArray(arg)
}

export function isEmpty<T>(o: unknown): o is Exclude<T, null | undefined> {
  return _.isEmpty(o)
}

// check if arg is a valid date
export function isValidDate(arg: unknown): arg is Date {
  // @ts-expect-error TS(2345): Argument of type 'Date' is not assignable to param... Remove this comment to see the full error message
  return arg instanceof Date && !isNaN(arg)
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
export function makeDateShort(date?: Date) {
  date = date || new Date()

  // Gives format like: '2017-08-07T16:28:59.889Z'
  const s = date.toISOString()

  return s.slice(0, 4) + s.slice(5, 7) + s.slice(8, 10)
}

// pipesetup sets up pipe() from left to right os streams array
// pipesetup will also make sure that error emitted at any of the upstream Stream
// will be emitted at the last stream. This makes error handling simple
export function pipesetup(src: stream.Readable, dst: stream.Writable) {
  src.on('error', (err: any) => dst.emit('error', err))
  return src.pipe(dst)
}

// return a Readable stream that emits data
export function readableStream(data: any): stream.Readable {
  let s = new stream.Readable()
  s._read = () => {}
  s.push(data)
  s.push(null)
  return s
}

// Process metadata to insert appropriate value to `content-type` attribute
export function insertContentType(metaData: MetaData, filePath: string) {
  // check if content-type attribute present in metaData
  for (let key in metaData) {
    if (key.toLowerCase() === 'content-type') {
      return metaData
    }
  }
  // if `content-type` attribute is not present in metadata,
  // then infer it from the extension in filePath
  let newMetadata = Object.assign({}, metaData)
  newMetadata['content-type'] = probeContentType(filePath)
  return newMetadata
}

// Function prepends metadata with the appropriate prefix if it is not already on
export function prependXAMZMeta(metaData: MetaData) {
  let newMetadata = Object.assign({}, metaData)
  for (let key in metaData) {
    if (!isAmzHeader(key) && !isSupportedHeader(key) && !isStorageclassHeader(key)) {
      newMetadata['X-Amz-Meta-' + key] = newMetadata[key]
      delete newMetadata[key]
    }
  }
  return newMetadata
}

// Checks if it is a valid header according to the AmazonS3 API
export function isAmzHeader(key: string) {
  let temp = key.toLowerCase()
  return (
    temp.startsWith('x-amz-meta-') ||
    temp === 'x-amz-acl' ||
    temp.startsWith('x-amz-server-side-encryption-') ||
    temp === 'x-amz-server-side-encryption'
  )
}

// Checks if it is a supported Header
export function isSupportedHeader(key: string) {
  let supported_headers = [
    'content-type',
    'cache-control',
    'content-encoding',
    'content-disposition',
    'content-language',
    'x-amz-website-redirect-location',
  ]
  return supported_headers.indexOf(key.toLowerCase()) > -1
}

// Checks if it is a storage header
export function isStorageclassHeader(key: string) {
  return key.toLowerCase() === 'x-amz-storage-class'
}

export function extractMetadata(metaData: MetaData) {
  let newMetadata = {}
  for (let key in metaData) {
    if (isSupportedHeader(key) || isStorageclassHeader(key) || isAmzHeader(key)) {
      if (key.toLowerCase().startsWith('x-amz-meta-')) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        newMetadata[key.slice(11, key.length)] = metaData[key]
      } else {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        newMetadata[key] = metaData[key]
      }
    }
  }
  return newMetadata
}

export function getVersionId(headers: IncomingHttpHeaders = {}) {
  const versionIdValue = headers['x-amz-version-id'] as string
  return versionIdValue || null
}

export function getSourceVersionId(headers: IncomingHttpHeaders = {}) {
  const sourceVersionId = headers['x-amz-copy-source-version-id']
  return sourceVersionId || null
}

export function sanitizeETag(etag = ''): string {
  let replaceChars = { '"': '', '&quot;': '', '&#34;': '', '&QUOT;': '', '&#x00022': '' }
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return etag.replace(/^("|&quot;|&#34;)|("|&quot;|&#34;)$/g, (m) => replaceChars[m])
}

export const RETENTION_MODES = {
  GOVERNANCE: 'GOVERNANCE',
  COMPLIANCE: 'COMPLIANCE',
} as const

export const RETENTION_VALIDITY_UNITS = {
  DAYS: 'Days',
  YEARS: 'Years',
} as const

export const LEGAL_HOLD_STATUS = {
  ENABLED: 'ON',
  DISABLED: 'OFF',
} as const

const objectToBuffer = (payload: Binary): Buffer => {
  // don't know how to write this...
  return Buffer.from(payload as Buffer)
}

export const toMd5 = (payload: Binary): string => {
  let payLoadBuf: Binary = objectToBuffer(payload)
  // use string from browser and buffer from nodejs
  // browser support is tested only against minio server
  payLoadBuf = isBrowser ? payLoadBuf.toString() : payLoadBuf
  return Crypto.createHash('md5').update(payLoadBuf).digest().toString('base64')
}

export const toSha256 = (payload: Binary) => {
  return Crypto.createHash('sha256').update(payload).digest('hex')
}

// toArray returns a single element array with param being the element,
// if param is just a string, and returns 'param' back if it is an array
// So, it makes sure param is always an array
export function toArray<T = unknown>(param: T | T[]): Array<T> {
  if (!Array.isArray(param)) {
    return [param] as T[]
  }
  return param
}

export function sanitizeObjectKey(objectName: string): string {
  // + symbol characters are not decoded as spaces in JS. so replace them first and decode to get the correct result.
  let asStrName = (objectName ? objectName.toString() : '').replace(/\+/g, ' ')
  return decodeURIComponent(asStrName)
}

export const PART_CONSTRAINTS = {
  // absMinPartSize - absolute minimum part size (5 MiB)
  ABS_MIN_PART_SIZE: 1024 * 1024 * 5,
  // MIN_PART_SIZE - minimum part size 16MiB per object after which
  MIN_PART_SIZE: 1024 * 1024 * 16,
  // MAX_PARTS_COUNT - maximum number of parts for a single multipart session.
  MAX_PARTS_COUNT: 10000,
  // MAX_PART_SIZE - maximum part size 5GiB for a single multipart upload
  // operation.
  MAX_PART_SIZE: 1024 * 1024 * 1024 * 5,
  // MAX_SINGLE_PUT_OBJECT_SIZE - maximum size 5GiB of object per PUT
  // operation.
  MAX_SINGLE_PUT_OBJECT_SIZE: 1024 * 1024 * 1024 * 5,
  // MAX_MULTIPART_PUT_OBJECT_SIZE - maximum size 5TiB of object for
  // Multipart operation.
  MAX_MULTIPART_PUT_OBJECT_SIZE: 1024 * 1024 * 1024 * 1024 * 5,
}

export const ENCRYPTION_TYPES = {
  // SSEC represents server-side-encryption with customer provided keys
  SSEC: 'SSE-C',
  // KMS represents server-side-encryption with managed keys
  KMS: 'KMS',
}
const GENERIC_SSE_HEADER = 'X-Amz-Server-Side-Encryption'

const ENCRYPTION_HEADERS = {
  // sseGenericHeader is the AWS SSE header used for SSE-S3 and SSE-KMS.
  sseGenericHeader: GENERIC_SSE_HEADER,
  // sseKmsKeyID is the AWS SSE-KMS key id.
  sseKmsKeyID: GENERIC_SSE_HEADER + '-Aws-Kms-Key-Id',
}

/**
 * Return Encryption headers
 * @param encConfig
 * @returns an object with key value pairs that can be used in headers.
 */
function getEncryptionHeaders(encConfig: Encryption): Header {
  const encType = encConfig.type
  const encHeaders = {}
  if (!_.isEmpty(encType)) {
    if (encType === ENCRYPTION_TYPES.SSEC) {
      return {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        [encHeaders[ENCRYPTION_HEADERS.sseGenericHeader]]: 'AES256',
      }
    } else if (encType === ENCRYPTION_TYPES.KMS) {
      return {
        [ENCRYPTION_HEADERS.sseGenericHeader]: encConfig.SSEAlgorithm,
        [ENCRYPTION_HEADERS.sseKmsKeyID]: encConfig.KMSMasterKeyID,
      }
    }
  }

  return encHeaders
}

export class CopySourceOptions {
  private Bucket: string
  private Object: string
  private VersionID: string
  private MatchETag: string
  private NoMatchETag: string
  private MatchModifiedSince: string | null
  private MatchUnmodifiedSince: string | null
  private MatchRange: boolean
  private Start: number
  private End: number
  private Encryption: Encryption

  /**
   *
   * @param Bucket __string__ Bucket Name
   * @param Object __string__ Object Name
   * @param VersionID __string__ Valid versionId
   * @param MatchETag __string__ Etag to match
   * @param NoMatchETag __string__ Etag to exclude
   * @param MatchModifiedSince __string__ Modified Date of the object/part.  UTC Date in string format
   * @param MatchUnmodifiedSince __string__ Modified Date of the object/part to exclude UTC Date in string format
   * @param MatchRange __boolean__ true or false Object range to match
   * @param Start
   * @param End
   * @param Encryption
   */
  constructor({
    Bucket = '',
    Object = '',
    VersionID = '',
    MatchETag = '',
    NoMatchETag = '',
    MatchModifiedSince = null,
    MatchUnmodifiedSince = null,
    MatchRange = false,
    Start = 0,
    End = 0,
    Encryption = {},
  }: {
    Bucket?: string
    Object?: string
    VersionID?: string
    MatchETag?: string
    NoMatchETag?: string
    MatchModifiedSince?: string | null
    MatchUnmodifiedSince?: string | null
    MatchRange?: boolean
    Start?: number
    End?: number
    Encryption?: Encryption
  } = {}) {
    this.Bucket = Bucket
    this.Object = Object
    this.VersionID = VersionID
    this.MatchETag = MatchETag
    this.NoMatchETag = NoMatchETag
    this.MatchModifiedSince = MatchModifiedSince
    this.MatchUnmodifiedSince = MatchUnmodifiedSince
    this.MatchRange = MatchRange
    this.Start = Start
    this.End = End
    this.Encryption = Encryption
  }

  validate() {
    if (!isValidBucketName(this.Bucket)) {
      throw new errors.InvalidBucketNameError('Invalid Source bucket name: ' + this.Bucket)
    }
    if (!isValidObjectName(this.Object)) {
      throw new errors.InvalidObjectNameError(`Invalid Source object name: ${this.Object}`)
    }
    if ((this.MatchRange && this.Start !== -1 && this.End !== -1 && this.Start > this.End) || this.Start < 0) {
      throw new errors.InvalidObjectNameError('Source start must be non-negative, and start must be at most end.')
    } else if ((this.MatchRange && !isNumber(this.Start)) || !isNumber(this.End)) {
      throw new errors.InvalidObjectNameError(
        'MatchRange is specified. But  Invalid Start and End values are specified. '
      )
    }

    return true
  }

  getHeaders() {
    let headerOptions: Header = {}
    headerOptions['x-amz-copy-source'] = encodeURI(this.Bucket + '/' + this.Object)

    if (!_.isEmpty(this.VersionID)) {
      headerOptions['x-amz-copy-source'] = encodeURI(this.Bucket + '/' + this.Object) + '?versionId=' + this.VersionID
    }

    if (!_.isEmpty(this.MatchETag)) {
      headerOptions['x-amz-copy-source-if-match'] = this.MatchETag
    }
    if (!_.isEmpty(this.NoMatchETag)) {
      headerOptions['x-amz-copy-source-if-none-match'] = this.NoMatchETag
    }

    if (!_.isEmpty(this.MatchModifiedSince)) {
      headerOptions['x-amz-copy-source-if-modified-since'] = this.MatchModifiedSince
    }
    if (!_.isEmpty(this.MatchUnmodifiedSince)) {
      headerOptions['x-amz-copy-source-if-unmodified-since'] = this.MatchUnmodifiedSince
    }

    return headerOptions
  }
}

interface Encryption {
  type?: string
  SSEAlgorithm?: string
  KMSMasterKeyID?: string
}

export class CopyDestinationOptions {
  private Bucket: string
  private Object: string
  private Encryption: Encryption | null
  private UserMetadata: MetaData | null
  private UserTags: Record<string, any> | string | null
  private LegalHold: 'on' | 'off' | null
  private RetainUntilDate: string | null
  private Mode: 'GOVERNANCE' | 'COMPLIANCE' | null

  /*
   * @param Bucket __string__
   * @param Object __string__ Object Name for the destination (composed/copied) object defaults
   * @param Encryption __object__ Encryption configuration defaults to {}
   * @param UserMetadata __object__
   * @param UserTags __object__ | __string__
   * @param LegalHold __string__  ON | OFF
   * @param RetainUntilDate __string__ UTC Date String
   * @param Mode
   */
  constructor({
    Bucket = '',
    Object = '',
    Encryption = null,
    UserMetadata = null,
    UserTags = null,
    LegalHold = null,
    RetainUntilDate = null,
    Mode = null, //
  }: {
    Bucket?: string
    Object?: string
    Encryption?: Encryption | null
    UserMetadata?: MetaData | null
    UserTags?: Record<string, any> | string | null
    LegalHold?: 'on' | 'off' | null
    RetainUntilDate?: string | null
    Mode?: 'GOVERNANCE' | 'COMPLIANCE' | null
  }) {
    this.Bucket = Bucket
    this.Object = Object
    this.Encryption = Encryption
    this.UserMetadata = UserMetadata
    this.UserTags = UserTags
    this.LegalHold = LegalHold
    this.Mode = Mode // retention mode
    this.RetainUntilDate = RetainUntilDate
  }

  getHeaders() {
    const replaceDirective = 'REPLACE'
    const headerOptions: Header = {}

    const userTags = this.UserTags
    if (!_.isEmpty(userTags)) {
      headerOptions['X-Amz-Tagging-Directive'] = replaceDirective
      headerOptions['X-Amz-Tagging'] = isObject(userTags)
        ? querystring.stringify(userTags)
        : isString(userTags)
        ? userTags
        : ''
    }

    if (!_.isEmpty(this.Mode)) {
      headerOptions['X-Amz-Object-Lock-Mode'] = this.Mode // GOVERNANCE or COMPLIANCE
    }

    if (!_.isEmpty(this.RetainUntilDate)) {
      headerOptions['X-Amz-Object-Lock-Retain-Until-Date'] = this.RetainUntilDate // needs to be UTC.
    }

    if (!_.isEmpty(this.LegalHold)) {
      headerOptions['X-Amz-Object-Lock-Legal-Hold'] = this.LegalHold // ON or OFF
    }

    if (!_.isEmpty(this.UserMetadata)) {
      for (const [key, value] of Object.entries(this.UserMetadata)) {
        headerOptions[`X-Amz-Meta-${key}`] = value.toString()
      }
    }

    if (!_.isEmpty(this.Encryption)) {
      const encryptionHeaders = getEncryptionHeaders(this.Encryption)
      for (const [key, value] of Object.entries(encryptionHeaders)) {
        headerOptions[key] = value
      }
    }
    return headerOptions
  }

  validate() {
    if (!isValidBucketName(this.Bucket)) {
      throw new errors.InvalidBucketNameError('Invalid Destination bucket name: ' + this.Bucket)
    }
    if (!isValidObjectName(this.Object)) {
      throw new errors.InvalidObjectNameError(`Invalid Destination object name: ${this.Object}`)
    }
    if (!_.isEmpty(this.UserMetadata) && !isObject(this.UserMetadata)) {
      throw new errors.InvalidObjectNameError(`Destination UserMetadata should be an object with key value pairs`)
    }

    if (!isEmpty(this.Mode) && ![RETENTION_MODES.GOVERNANCE, RETENTION_MODES.COMPLIANCE].includes(this.Mode)) {
      throw new errors.InvalidObjectNameError(
        `Invalid Mode specified for destination object it should be one of [GOVERNANCE,COMPLIANCE]`
      )
    }

    if (!isEmpty(this.Encryption) && _.isEmpty(this.Encryption)) {
      throw new errors.InvalidObjectNameError(`Invalid Encryption configuration for destination object `)
    }
    return true
  }
}

export const partsRequired = (size: number) => {
  let maxPartSize = PART_CONSTRAINTS.MAX_MULTIPART_PUT_OBJECT_SIZE / (PART_CONSTRAINTS.MAX_PARTS_COUNT - 1)
  let requiredPartSize = size / maxPartSize
  if (size % maxPartSize > 0) {
    requiredPartSize++
  }
  requiredPartSize = Math.trunc(requiredPartSize)
  return requiredPartSize
}

// calculateEvenSplits - computes splits for a source and returns
// start and end index slices. Splits happen evenly to be sure that no
// part is less than 5MiB, as that could fail the multipart request if
// it is not the last part.

let startIndexParts = []
let endIndexParts = []

export function calculateEvenSplits(size: number, objInfo: { Start?: unknown }) {
  if (size === 0) {
    return null
  }
  const reqParts = partsRequired(size)
  startIndexParts = new Array(reqParts)
  endIndexParts = new Array(reqParts)

  let start = objInfo.Start as number
  if (_.isEmpty(objInfo.Start) || start === -1) {
    start = 0
  }
  const divisorValue = Math.trunc(size / reqParts)

  const reminderValue = size % reqParts

  let nextStart = start

  for (let i = 0; i < reqParts; i++) {
    let curPartSize = divisorValue
    if (i < reminderValue) {
      curPartSize++
    }

    const currentStart = nextStart
    let currentEnd = currentStart + curPartSize - 1
    nextStart = currentEnd + 1

    startIndexParts[i] = currentStart
    endIndexParts[i] = currentEnd
  }

  return { startIndex: startIndexParts, endIndex: endIndexParts, objInfo: objInfo }
}

export function removeDirAndFiles(dirPath: string, removeSelf?: boolean) {
  if (removeSelf === undefined) {
    removeSelf = true
  }
  let files: string[]
  try {
    files = fs.readdirSync(dirPath)
  } catch (e) {
    return
  }
  if (files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      let filePath = path.join(dirPath, files[i])
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath)
      } else {
        removeDirAndFiles(filePath)
      }
    }
  }
  if (removeSelf) {
    fs.rmdirSync(dirPath)
  }
}

export function parseXml(xml: string): any {
  let result = null
  result = fxp.parse(xml)
  if (result.Error) {
    throw result.Error
  }

  return result
}

export class SelectResults {
  private records: unknown
  private response: unknown
  private stats: unknown
  private progress: unknown

  constructor({
    records, // parsed data as stream
    response, // original response stream
    stats, // stats as xml
    progress, // stats as xml
  }: {
    records: unknown
    response: unknown
    stats: unknown
    progress: unknown
  }) {
    this.records = records
    this.response = response
    this.stats = stats
    this.progress = progress
  }

  setStats(stats: unknown) {
    this.stats = stats
  }

  getStats() {
    return this.stats
  }

  setProgress(progress: unknown) {
    this.progress = progress
  }

  getProgress() {
    return this.progress
  }

  setResponse(response: unknown) {
    this.response = response
  }

  getResponse() {
    return this.response
  }

  setRecords(records: unknown) {
    this.records = records
  }

  getRecords(): unknown {
    return this.records
  }
}

export const DEFAULT_REGION = 'us-east-1'
