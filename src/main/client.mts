import type { IncomingMessage } from 'http'
import Http from 'http'
import Https from 'https'
import _ from 'lodash'
import type * as Stream from 'stream'

import { isBoolean, isFunction, isNumber, isObject, isReadableStream, isString } from './asserts.mts'
import { CopyConditions } from './copyConditions.mjs'
import type CredentialProvider from './CredentialProvider.mts'
import * as errors from './errors.mts'
import extensions from './extensions.mts'
import {
  isAmazonEndpoint,
  isValidBucketName,
  isValidEndpoint,
  isValidPort,
  isVirtualHostStyle,
  makeDateLong,
  pipesetup,
  readableStream,
  toSha256,
  uriResourceEscape,
} from './helpers.mts'
import { PostPolicy } from './postPolicy.mjs'
import type { Region } from './s3-endpoints.mts'
import { DEFAULT_REGION, getS3Endpoint } from './s3-endpoints.mts'
import { signV4 } from './signing.mts'
import * as transformers from './transformers.mts'
import type { IRequest, RequestHeader } from './type.ts'
import type { Binary } from './type.ts'

export * from './helpers.mts'
export * from './notification/index.mts'
export { DEFAULT_REGION }
export { removeDirAndFiles } from '../test/utils.mjs'
export * from './helpers.mts'
export { SelectResults } from './SelectResults.mts'
export { CopyConditions, PostPolicy }
import { isBrowser } from 'browser-or-node'

export interface ClientOptions {
  endPoint: string
  accessKey: string
  secretKey: string
  useSSL?: boolean
  port?: number
  region?: Region
  transport?: typeof Http | typeof Https
  sessionToken?: string
  partSize?: number
  pathStyle?: boolean
  credentialsProvider?: CredentialProvider
  s3AccelerateEndpoint?: string
}

const requestOptionProperties = [
  'agent',
  'ca',
  'cert',
  'ciphers',
  'clientCertEngine',
  'crl',
  'dhparam',
  'ecdhCurve',
  'family',
  'honorCipherOrder',
  'key',
  'passphrase',
  'pfx',
  'rejectUnauthorized',
  'secureOptions',
  'secureProtocol',
  'servername',
  'sessionIdContext',
] as const
// will be replaced by rollup plugin
const version = process.env.MINIO_JS_PACKAGE_VERSION || 'development'
const Package = { version }

type RequestOption = Partial<IRequest> & {
  method: string
  bucketName: string
  objectName?: string
  region?: string
  query?: string
  pathStyle?: boolean
}

export class TypedClient {
  private transport: typeof Http | typeof Https
  private host: string
  private port: number
  private protocol: string
  private accessKey: string
  private secretKey: string
  private sessionToken: string | undefined
  private userAgent: string
  private anonymous: boolean
  private pathStyle: boolean
  private regionMap: Record<string, string>
  private region?: string
  private credentialsProvider?: CredentialProvider
  private partSize: number = 64 * 1024 * 1024
  private overRidePartSize?: boolean

  private maximumPartSize = 5 * 1024 * 1024 * 1024
  private maxObjectSize = 5 * 1024 * 1024 * 1024 * 1024
  private enableSHA256: boolean
  private s3AccelerateEndpoint?: string
  private reqOptions: Record<string, any>

  // TODO: add this
  // private clientExtensions: extensions
  private logStream?: Stream.Writable

  constructor(params: ClientOptions) {
    // @ts-expect-error deprecated property
    if (typeof params.secure !== 'undefined') {
      throw new Error('"secure" option deprecated, "useSSL" should be used instead')
    }
    // Default values if not specified.
    if (typeof params.useSSL === 'undefined') {
      params.useSSL = true
    }
    if (!params.port) {
      params.port = 0
    }
    // Validate input params.
    if (!isValidEndpoint(params.endPoint)) {
      throw new errors.InvalidEndpointError(`Invalid endPoint : ${params.endPoint}`)
    }
    if (!isValidPort(params.port)) {
      throw new errors.InvalidArgumentError(`Invalid port : ${params.port}`)
    }
    if (!isBoolean(params.useSSL)) {
      throw new errors.InvalidArgumentError(
        `Invalid useSSL flag type : ${params.useSSL}, expected to be of type "boolean"`
      )
    }

    // Validate region only if its set.
    if (params.region) {
      if (!isString(params.region)) {
        throw new errors.InvalidArgumentError(`Invalid region : ${params.region}`)
      }
    }

    let host = params.endPoint.toLowerCase()
    let port = params.port
    let protocol = ''
    let transport
    // Validate if configuration is not using SSL
    // for constructing relevant endpoints.
    if (!params.useSSL) {
      transport = Http
      protocol = 'http:'
      if (port === 0) {
        port = 80
      }
    } else {
      // Defaults to secure.
      transport = Https
      protocol = 'https:'
      if (port === 0) {
        port = 443
      }
    }

    // if custom transport is set, use it.
    if (params.transport) {
      if (!isObject(params.transport)) {
        throw new errors.InvalidArgumentError(
          `Invalid transport type : ${params.transport}, expected to be type "object"`
        )
      }
      transport = params.transport
    }

    // User Agent should always following the below style.
    // Please open an issue to discuss any new changes here.
    //
    //       MinIO (OS; ARCH) LIB/VER APP/VER
    //
    let libraryComments = `(${process.platform}; ${process.arch})`
    let libraryAgent = `MinIO ${libraryComments} minio-js/${Package.version}`
    // User agent block ends.

    this.transport = transport
    this.host = host
    this.port = port
    this.protocol = protocol
    this.accessKey = params.accessKey
    this.secretKey = params.secretKey
    this.sessionToken = params.sessionToken
    this.userAgent = `${libraryAgent}`

    // Default path style is true
    if (params.pathStyle === undefined) {
      this.pathStyle = true
    } else {
      this.pathStyle = params.pathStyle
    }

    if (!this.accessKey) {
      this.accessKey = ''
    }
    if (!this.secretKey) {
      this.secretKey = ''
    }
    this.anonymous = !this.accessKey || !this.secretKey

    if (params.credentialsProvider) {
      this.credentialsProvider = params.credentialsProvider
      this.checkAndRefreshCreds()
    }

    this.regionMap = {}
    if (params.region) {
      this.region = params.region
    }

    if (params.partSize) {
      this.partSize = params.partSize
      this.overRidePartSize = true
    }
    if (this.partSize < 5 * 1024 * 1024) {
      throw new errors.InvalidArgumentError(`Part size should be greater than 5MB`)
    }
    if (this.partSize > 5 * 1024 * 1024 * 1024) {
      throw new errors.InvalidArgumentError(`Part size should be less than 5GB`)
    }

    // SHA256 is enabled only for authenticated http requests. If the request is authenticated
    // and the connection is https we use x-amz-content-sha256=UNSIGNED-PAYLOAD
    // header for signature calculation.
    this.enableSHA256 = !this.anonymous && !params.useSSL

    this.s3AccelerateEndpoint = params.s3AccelerateEndpoint || undefined
    this.reqOptions = {}

    // this.clientExtensions = new extensions(this)
  }

  get extensions() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // TODO: cache this
    return new extensions(this)
    // return this.clientExtensions
  }

  // This is s3 Specific and does not hold validity in any other Object storage.
  private getAccelerateEndPointIfSet(bucketName: string, objectName?: string) {
    if (!_.isEmpty(this.s3AccelerateEndpoint) && !_.isEmpty(bucketName) && !_.isEmpty(objectName)) {
      // http://docs.aws.amazon.com/AmazonS3/latest/dev/transfer-acceleration.html
      // Disable transfer acceleration for non-compliant bucket names.
      if (bucketName.indexOf('.') !== -1) {
        throw new Error(`Transfer Acceleration is not supported for non compliant bucket:${bucketName}`)
      }
      // If transfer acceleration is requested set new host.
      // For more details about enabling transfer acceleration read here.
      // http://docs.aws.amazon.com/AmazonS3/latest/dev/transfer-acceleration.html
      return this.s3AccelerateEndpoint
    }
    return false
  }

  /**
   * @param endPoint - valid S3 acceleration end point
   */
  public setS3TransferAccelerate(endPoint: string) {
    this.s3AccelerateEndpoint = endPoint
  }

  // returns *options* object that can be used with http.request()

  // Sets the supported request options.
  public setRequestOptions(options: Record<(typeof requestOptionProperties)[number], any>) {
    // TODO: add options type details
    if (!isObject(options)) {
      throw new TypeError('request options should be of type "object"')
    }
    this.reqOptions = _.pick(options, requestOptionProperties)
  }

  // Set application specific information.
  //
  // Generates User-Agent in the following style.
  //
  //       MinIO (OS; ARCH) LIB/VER APP/VER
  //
  // __Arguments__
  // * `appName` _string_ - Application name.

  // Takes care of constructing virtual-host-style or path-style hostname
  private getRequestOptions(opts: RequestOption): IRequest & { host: string } {
    let method = opts.method
    let region = opts.region
    let bucketName = opts.bucketName
    let objectName = opts.objectName
    let headers = opts.headers
    let query = opts.query

    let reqOptions = {
      method,
      headers: {} as RequestHeader,
      protocol: this.protocol,
    }

    // Verify if virtual host supported.
    let virtualHostStyle
    if (bucketName) {
      virtualHostStyle = isVirtualHostStyle(this.host, this.protocol, bucketName, this.pathStyle)
    }

    let path = '/'
    let host = this.host

    let port: undefined | number
    if (this.port) {
      port = this.port
    }

    if (objectName) {
      objectName = `${uriResourceEscape(objectName)}`
    }

    // For Amazon S3 endpoint, get endpoint based on region.
    if (isAmazonEndpoint(host)) {
      const accelerateEndPoint = this.getAccelerateEndPointIfSet(bucketName, objectName)
      if (accelerateEndPoint) {
        host = `${accelerateEndPoint}`
      } else {
        host = getS3Endpoint(region!)
      }
    }

    if (virtualHostStyle && !opts.pathStyle) {
      // For all hosts which support virtual host style, `bucketName`
      // is part of the hostname in the following format:
      //
      //  var host = 'bucketName.example.com'
      //
      if (bucketName) {
        host = `${bucketName}.${host}`
      }
      if (objectName) {
        path = `/${objectName}`
      }
    } else {
      // For all S3 compatible storage services we will fallback to
      // path style requests, where `bucketName` is part of the URI
      // path.
      if (bucketName) {
        path = `/${bucketName}`
      }
      if (objectName) {
        path = `/${bucketName}/${objectName}`
      }
    }

    if (query) {
      path += `?${query}`
    }
    reqOptions.headers.host = host
    if ((reqOptions.protocol === 'http:' && port !== 80) || (reqOptions.protocol === 'https:' && port !== 443)) {
      reqOptions.headers.host = `${host}:${port}`
    }
    reqOptions.headers['user-agent'] = this.userAgent
    if (headers) {
      // have all header keys in lower case - to make signing easy
      for (const [k, v] of Object.entries(headers)) {
        reqOptions.headers[k.toLowerCase()] = v
      }
    }

    // Use any request option specified in minioClient.setRequestOptions()
    reqOptions = Object.assign({}, this.reqOptions, reqOptions)

    return {
      ...reqOptions,
      host,
      port,
      path,
    }
  }

  // * `appVersion` _string_ - Application version.
  setAppInfo(appName: string, appVersion: string) {
    if (!isString(appName)) {
      throw new TypeError(`Invalid appName: ${appName}`)
    }
    if (appName.trim() === '') {
      throw new errors.InvalidArgumentError('Input appName cannot be empty.')
    }
    if (!isString(appVersion)) {
      throw new TypeError(`Invalid appVersion: ${appVersion}`)
    }
    if (appVersion.trim() === '') {
      throw new errors.InvalidArgumentError('Input appVersion cannot be empty.')
    }
    this.userAgent = `${this.userAgent} ${appName}/${appVersion}`
  }

  // Calculate part size given the object size. Part size will be atleast this.partSize
  calculatePartSize(size: number) {
    if (!isNumber(size)) {
      throw new TypeError('size should be of type "number"')
    }
    if (size > this.maxObjectSize) {
      throw new TypeError(`size should not be more than ${this.maxObjectSize}`)
    }
    if (this.overRidePartSize) {
      return this.partSize
    }
    let partSize = this.partSize
    for (;;) {
      // while(true) {...} throws linting error.
      // If partSize is big enough to accomodate the object size, then use it.
      if (partSize * 10000 > size) {
        return partSize
      }
      // Try part sizes as 64MB, 80MB, 96MB etc.
      partSize += 16 * 1024 * 1024
    }
  }

  // log the request, response, error
  logHTTP(reqOptions: IRequest, response: IncomingMessage | null, err?: unknown) {
    // if no logstreamer available return.
    if (!this.logStream) {
      return
    }
    if (!isObject(reqOptions)) {
      throw new TypeError('reqOptions should be of type "object"')
    }
    if (response && !isReadableStream(response)) {
      throw new TypeError('response should be of type "Stream"')
    }
    if (err && !(err instanceof Error)) {
      throw new TypeError('err should be of type "Error"')
    }
    let logHeaders = (headers: RequestHeader) => {
      _.forEach(headers, (v, k) => {
        if (k == 'authorization') {
          let redacter = new RegExp('Signature=([0-9a-f]+)')
          v = v.replace(redacter, 'Signature=**REDACTED**')
        }
        this.logStream?.write(`${k}: ${v}\n`)
      })
      this.logStream?.write('\n')
    }
    this.logStream.write(`REQUEST: ${reqOptions.method} ${reqOptions.path}\n`)
    logHeaders(reqOptions.headers)
    if (response) {
      this.logStream.write(`RESPONSE: ${response.statusCode}\n`)
      logHeaders(response.headers as RequestHeader)
    }
    if (err) {
      this.logStream.write('ERROR BODY:\n')
      let errJSON = JSON.stringify(err, null, '\t')
      this.logStream.write(`${errJSON}\n`)
    }
  }

  // Enable tracing
  traceOn(stream?: Stream.Writable) {
    if (!stream) {
      stream = process.stdout
    }
    this.logStream = stream
  }

  // makeRequest is the primitive used by the apis for making S3 requests.
  // payload can be empty string in case of no payload.
  // statusCode is the expected statusCode. If response.statusCode does not match
  // we parse the XML error and call the callback with the error message.
  // A valid region is passed by the calls - listBuckets, makeBucket and

  // Disable tracing
  traceOff() {
    this.logStream = undefined
  }

  // makeRequestStream will be used directly instead of makeRequest in case the payload

  // getBucketRegion.
  makeRequest(
    options: RequestOption,
    payload: Binary,
    statusCodes: number[],
    region: string,
    returnResponse: boolean,
    cb: (err: null | Error, response?: IncomingMessage) => void
  ) {
    if (!isObject(options)) {
      throw new TypeError('options should be of type "object"')
    }
    if (!isString(payload) && !isObject(payload)) {
      // Buffer is of type 'object'
      throw new TypeError('payload should be of type "string" or "Buffer"')
    }
    statusCodes.forEach((statusCode) => {
      if (!isNumber(statusCode)) {
        throw new TypeError('statusCode should be of type "number"')
      }
    })
    if (!isString(region)) {
      throw new TypeError('region should be of type "string"')
    }
    if (!isBoolean(returnResponse)) {
      throw new TypeError('returnResponse should be of type "boolean"')
    }
    if (!isFunction(cb)) {
      throw new TypeError('callback should be of type "function"')
    }
    if (!options.headers) {
      options.headers = {}
    }
    if (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE') {
      options.headers['content-length'] = payload.length.toString()
    }
    let sha256sum = ''
    if (this.enableSHA256) {
      sha256sum = toSha256(payload)
    }
    let stream = readableStream(payload)
    this.makeRequestStream(options, stream, sha256sum, statusCodes, region, returnResponse, cb)
  }

  // is available as a stream. for ex. putObject
  makeRequestStream(
    options: RequestOption,
    stream: Stream.Readable,
    sha256sum: string,
    statusCodes: number[],
    region: string,
    returnResponse: boolean,
    requestStreamCallback: (err: null | Error, response?: IncomingMessage) => void
  ) {
    if (!isObject(options)) {
      throw new TypeError('options should be of type "object"')
    }
    if (!isReadableStream(stream)) {
      throw new errors.InvalidArgumentError('stream should be a readable Stream')
    }
    if (!isString(sha256sum)) {
      throw new TypeError('sha256sum should be of type "string"')
    }
    statusCodes.forEach((statusCode) => {
      if (!isNumber(statusCode)) {
        throw new TypeError('statusCode should be of type "number"')
      }
    })
    if (!isString(region)) {
      throw new TypeError('region should be of type "string"')
    }
    if (!isBoolean(returnResponse)) {
      throw new TypeError('returnResponse should be of type "boolean"')
    }
    if (!isFunction(requestStreamCallback)) {
      throw new TypeError('callback should be of type "function"')
    }

    // sha256sum will be empty for anonymous or https requests
    if (!this.enableSHA256 && sha256sum.length !== 0) {
      throw new errors.InvalidArgumentError(`sha256sum expected to be empty for anonymous or https requests`)
    }
    // sha256sum should be valid for non-anonymous http requests.
    if (this.enableSHA256 && sha256sum.length !== 64) {
      throw new errors.InvalidArgumentError(`Invalid sha256sum : ${sha256sum}`)
    }

    let _makeRequest = (e: null | Error, region: string) => {
      if (e) {
        return requestStreamCallback(e)
      }
      options.region = region
      let reqOptions = this.getRequestOptions(options)
      if (!this.anonymous) {
        // For non-anonymous https requests sha256sum is 'UNSIGNED-PAYLOAD' for signature calculation.
        if (!this.enableSHA256) {
          sha256sum = 'UNSIGNED-PAYLOAD'
        }

        let date = new Date()

        reqOptions.headers['x-amz-date'] = makeDateLong(date)
        reqOptions.headers['x-amz-content-sha256'] = sha256sum
        if (this.sessionToken) {
          reqOptions.headers['x-amz-security-token'] = this.sessionToken
        }

        this.checkAndRefreshCreds()
        let authorization = signV4(reqOptions, this.accessKey, this.secretKey, region, date)
        reqOptions.headers.authorization = authorization
      }
      let req = this.transport.request(reqOptions, (response) => {
        if (!statusCodes.includes(response.statusCode!)) {
          // For an incorrect region, S3 server always sends back 400.
          // But we will do cache invalidation for all errors so that,
          // in future, if AWS S3 decides to send a different status code or
          // XML error code we will still work fine.
          delete this.regionMap[options.bucketName]
          // @ts-expect-error looks like `getErrorTransformer` want a `http.ServerResponse`,
          // but we only have a http.IncomingMessage here
          let errorTransformer = transformers.getErrorTransformer(response)
          pipesetup(response, errorTransformer).on('error', (e) => {
            this.logHTTP(reqOptions, response, e)
            requestStreamCallback(e)
          })
          return
        }
        this.logHTTP(reqOptions, response)
        if (returnResponse) {
          return requestStreamCallback(null, response)
        }
        // We drain the socket so that the connection gets closed. Note that this
        // is not expensive as the socket will not have any data.
        response.on('data', () => {})
        requestStreamCallback(null)
      })
      let pipe = pipesetup(stream, req)
      pipe.on('error', (e) => {
        this.logHTTP(reqOptions, null, e)
        requestStreamCallback(e)
      })
    }
    if (region) {
      return _makeRequest(null, region)
    }
    this.getBucketRegion(options.bucketName, _makeRequest)
  }

  // Creates the bucket `bucketName`.
  //
  // __Arguments__
  // * `bucketName` _string_ - Name of the bucket
  // * `region` _string_ - region valid values are _us-west-1_, _us-west-2_,  _eu-west-1_, _eu-central-1_, _ap-southeast-1_, _ap-northeast-1_, _ap-southeast-2_, _sa-east-1_.
  // * `makeOpts` _object_ - Options to create a bucket. e.g {ObjectLocking:true} (Optional)

  // gets the region of the bucket
  getBucketRegion(bucketName: string, cb: (err: null | Error, region: string) => void) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name : ${bucketName}`)
    }
    if (!isFunction(cb)) {
      throw new TypeError('cb should be of type "function"')
    }

    // Region is set with constructor, return the region right here.
    if (this.region) {
      return cb(null, this.region)
    }

    if (this.regionMap[bucketName]) {
      return cb(null, this.regionMap[bucketName])
    }
    let extractRegion = (response: IncomingMessage) => {
      let transformer = transformers.getBucketRegionTransformer()
      let region = DEFAULT_REGION
      pipesetup(response, transformer)
        .on('error', cb)
        .on('data', (data) => {
          if (data) {
            region = data
          }
        })
        .on('end', () => {
          this.regionMap[bucketName] = region
          cb(null, region)
        })
    }

    let method = 'GET'
    let query = 'location'

    // `getBucketLocation` behaves differently in following ways for
    // different environments.
    //
    // - For nodejs env we default to path style requests.
    // - For browser env path style requests on buckets yields CORS
    //   error. To circumvent this problem we make a virtual host
    //   style request signed with 'us-east-1'. This request fails
    //   with an error 'AuthorizationHeaderMalformed', additionally
    //   the error XML also provides Region of the bucket. To validate
    //   this region is proper we retry the same request with the newly
    //   obtained region.
    let pathStyle = this.pathStyle && !isBrowser

    this.makeRequest({ method, bucketName, query, pathStyle }, '', [200], DEFAULT_REGION, true, (e, response) => {
      if (e) {
        if (e.name === 'AuthorizationHeaderMalformed') {
          // @ts-expect-error we set extra properties on error object
          let region = e.Region
          if (!region) {
            return cb(e)
          }
          this.makeRequest({ method, bucketName, query }, '', [200], region, true, (e, response) => {
            if (e) {
              return cb(e)
            }
            if (!response) {
              throw new Error('BUG: callback missing response argument')
            }
            extractRegion(response)
          })
          return
        }
        return cb(e)
      }
      if (!response) {
        throw new Error('BUG: callback missing response argument')
      }
      extractRegion(response)
    })
  }

  async checkAndRefreshCreds() {
    if (this.credentialsProvider) {
      return await this.fetchCredentials()
    }
  }

  async fetchCredentials() {
    if (this.credentialsProvider) {
      const credentialsConf = await this.credentialsProvider.getCredentials()
      if (credentialsConf) {
        // @ts-expect-error secretKey maybe undefined
        this.accessKey = credentialsConf.getAccessKey()
        // @ts-expect-error secretKey maybe undefined
        this.secretKey = credentialsConf.getSecretKey()
        this.sessionToken = credentialsConf.getSessionToken()
      } else {
        throw new Error('Unable to get credentials. Expected instance of BaseCredentialsProvider')
      }
    } else {
      throw new Error('Unable to get credentials. Expected instance of BaseCredentialsProvider')
    }
  }
}
