export type RequestHeader = Record<string, string>

export interface IRequest {
  protocol: string
  method: string
  path: string
  headers: RequestHeader
}

export type ICanonicalRequest = string
