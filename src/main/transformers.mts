/*
 * MinIO Javascript Library for Amazon S3 Compatible Cloud Storage, (C) 2015, 2016 MinIO, Inc.
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
import type * as stream from 'node:stream'

import type { ServerResponse } from 'http'
import Through2 from 'through2'

import { isFunction } from './asserts.mts'
import * as errors from './errors.mts'
import JSONParser from './vendor/json-stream.mjs'
import * as xmlParsers from './xml-parsers/index.mts'

// getConcater returns a stream that concatenates the input and emits
// the concatenated output when 'end' has reached. If an optional
// parser function is passed upon reaching the 'end' of the stream,
// `parser(concatenated_data)` will be emitted.
export function getConcater(parser?: undefined | ((xml: string) => any), emitError?: boolean): stream.Transform {
  let objectMode = false
  let bufs: Buffer[] = []

  if (parser && !isFunction(parser)) {
    throw new TypeError('parser should be of type "function"')
  }

  if (parser) {
    objectMode = true
  }

  return Through2(
    { objectMode },
    function (chunk, enc, cb) {
      bufs.push(chunk)
      cb()
    },
    function (cb) {
      if (emitError) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        cb(parser(Buffer.concat(bufs).toString()))
        // cb(e) would mean we have to emit 'end' by explicitly calling this.push(null)
        this.push(null)
        return
      }
      if (bufs.length) {
        if (parser) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          this.push(parser(Buffer.concat(bufs).toString()))
        } else {
          this.push(Buffer.concat(bufs))
        }
      }
      cb()
    }
  )
}

// Generates an Error object depending on http statusCode and XML body
export function getErrorTransformer(response: ServerResponse) {
  let statusCode = response.statusCode
  let code: string, message: string
  if (statusCode === 301) {
    code = 'MovedPermanently'
    message = 'Moved Permanently'
  } else if (statusCode === 307) {
    code = 'TemporaryRedirect'
    message = 'Are you using the correct endpoint URL?'
  } else if (statusCode === 403) {
    code = 'AccessDenied'
    message = 'Valid and authorized credentials required'
  } else if (statusCode === 404) {
    code = 'NotFound'
    message = 'Not Found'
  } else if (statusCode === 405) {
    code = 'MethodNotAllowed'
    message = 'Method Not Allowed'
  } else if (statusCode === 501) {
    code = 'MethodNotAllowed'
    message = 'Method Not Allowed'
  } else {
    code = 'UnknownError'
    message = `${statusCode}`
  }

  let headerInfo: Record<string, string | undefined | null> = {}
  // A value created by S3 compatible server that uniquely identifies the request.
  headerInfo.amzRequestid = response.headersSent ? (response.getHeader('x-amz-request-id') as string | undefined) : null
  // A special token that helps troubleshoot API replies and issues.
  headerInfo.amzId2 = response.headersSent ? (response.getHeader('x-amz-id-2') as string | undefined) : null
  // Region where the bucket is located. This header is returned only
  // in HEAD bucket and ListObjects response.
  headerInfo.amzBucketRegion = response.headersSent
    ? (response.getHeader('x-amz-bucket-region') as string | undefined)
    : null

  return getConcater((xmlString) => {
    let getError = () => {
      // Message should be instantiated for each S3Errors.
      let e = new errors.S3Error(message)
      // S3 Error code.
      // @ts-expect-error force set error properties
      e.code = code
      Object.entries(headerInfo).forEach(([value, key]) => {
        // @ts-expect-error force set error properties
        e[key] = value
      })
      return e
    }
    if (!xmlString) {
      return getError()
    }
    let e
    try {
      e = xmlParsers.parseError(xmlString, headerInfo)
    } catch (ex) {
      return getError()
    }
    return e
  }, true)
}

// A through stream that calculates md5sum and sha256sum
export function getHashSummer(enableSHA256: boolean) {
  let md5 = Crypto.createHash('md5')
  let sha256 = Crypto.createHash('sha256')

  return Through2.obj(
    function (chunk, enc, cb) {
      if (enableSHA256) {
        sha256.update(chunk)
      } else {
        md5.update(chunk)
      }
      cb()
    },
    function (cb) {
      let md5sum = ''
      let sha256sum = ''
      if (enableSHA256) {
        sha256sum = sha256.digest('hex')
      } else {
        md5sum = md5.digest('base64')
      }
      let hashData = { md5sum, sha256sum }
      this.push(hashData)
      this.push(null)
      cb()
    }
  )
}

// Following functions return a stream object that parses XML
// and emits suitable Javascript objects.

// Parses CopyObject response.
export function getCopyObjectTransformer() {
  return getConcater(xmlParsers.parseCopyObject)
}

// Parses listBuckets response.
export function getListBucketTransformer() {
  return getConcater(xmlParsers.parseListBucket)
}

// Parses listMultipartUploads response.
export function getListMultipartTransformer() {
  return getConcater(xmlParsers.parseListMultipart)
}

// Parses listParts response.
export function getListPartsTransformer() {
  return getConcater(xmlParsers.parseListParts)
}

// Parses initMultipartUpload response.
export function getInitiateMultipartTransformer() {
  return getConcater(xmlParsers.parseInitiateMultipart)
}

// Parses listObjects response.
export function getListObjectsTransformer() {
  return getConcater(xmlParsers.parseListObjects)
}

// Parses listObjects response.
export function getListObjectsV2Transformer() {
  return getConcater(xmlParsers.parseListObjectsV2)
}

// Parses listObjects with metadata response.
export function getListObjectsV2WithMetadataTransformer() {
  return getConcater(xmlParsers.parseListObjectsV2WithMetadata)
}

// Parses completeMultipartUpload response.
export function getCompleteMultipartTransformer() {
  return getConcater(xmlParsers.parseCompleteMultipart)
}

// Parses getBucketLocation response.
export function getBucketRegionTransformer() {
  return getConcater(xmlParsers.parseBucketRegion)
}

// Parses GET/SET BucketNotification response
export function getBucketNotificationTransformer() {
  return getConcater(xmlParsers.parseBucketNotification)
}

// Parses a notification.
export function getNotificationTransformer() {
  // This will parse and return each object.
  return new JSONParser()
}

export function bucketVersioningTransformer() {
  return getConcater(xmlParsers.parseBucketVersioningConfig)
}

export function getTagsTransformer() {
  return getConcater(xmlParsers.parseTagging)
}

export function lifecycleTransformer() {
  return getConcater(xmlParsers.parseLifecycleConfig)
}

export function objectLockTransformer() {
  return getConcater(xmlParsers.parseObjectLockConfig)
}

export function objectRetentionTransformer() {
  return getConcater(xmlParsers.parseObjectRetentionConfig)
}

export function bucketEncryptionTransformer() {
  return getConcater(xmlParsers.parseBucketEncryptionConfig)
}

export function replicationConfigTransformer() {
  return getConcater(xmlParsers.parseReplicationConfig)
}

export function objectLegalHoldTransformer() {
  return getConcater(xmlParsers.parseObjectLegalHoldConfig)
}

export function uploadPartTransformer() {
  return getConcater(xmlParsers.uploadPartParser)
}

export function selectObjectContentTransformer() {
  return getConcater()
}

export function removeObjectsTransformer() {
  return getConcater(xmlParsers.removeObjectsParser)
}
