import { BinaryLike } from 'crypto'
import { IncomingMessage } from 'http'

import type { Client } from './minio.d.ts'
import type { ResultCallback } from './minio.d.ts'

export type RequestHeader = Record<string, string | number>

export interface IRequest {
  protocol: string
  hostname: string
  port: string
  method: string
  path: string
  headers: RequestHeader
}

export type ICanonicalRequest = string

export interface ICredentials {
  accessKey?: string
  secretKey?: string
  sessionToken?: string
}

type ResponseCallback = (err: unknown, res: IncomingMessage) => void

export type UploadID = string

export interface IClient extends Client {
  region: string
  enableSHA256: boolean

  makeRequest(
    options: Record<string, any>,
    payload: BinaryLike,
    statusCodes: number[],
    region: string,
    returnResponse: boolean,
    cb: ResponseCallback
  ): void

  makeRequestStream(
    options: Record<string, any>,
    stream: ReadableStream,
    sha256sum: string,
    statusCodes: number[],
    region: string,
    returnResponse: boolean,
    cb: ResponseCallback
  ): void

  completeMultipartUpload(
    bucketName: string,
    objectName: string,
    uploadId: UploadID,
    etags: { part: number; etag?: string }[],
    cb: ResultCallback<{
      etag: string
      versionId: string | null
    }>
  ): void

  listParts(
    bucketName: string,
    objectName: string,
    id: UploadID,
    param4: (
      err: Error | null,
      etags: {
        etag?: string
        part: number
      }[]
    ) => void
  ): void

  findUploadId(
    bucketName: string,
    objectName: string,
    param3: (err: Error | null, id: UploadID) => boolean | undefined
  ): void

  initiateNewMultipartUpload(
    bucketName: string,
    objectName: string,
    metaData: Record<string, string>,
    param4: (err: Error | null, id: UploadID) => void
  ): void
}
