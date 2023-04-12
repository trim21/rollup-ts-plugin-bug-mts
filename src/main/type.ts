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
