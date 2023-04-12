import { ICredentials } from './type.ts'

export default class Credentials {
  public accessKey?: string
  public secretKey?: string
  public sessionToken?: string

  constructor({
    accessKey,
    secretKey,
    sessionToken,
  }: {
    accessKey?: string
    secretKey?: string
    sessionToken?: string
  }) {
    this.accessKey = accessKey
    this.secretKey = secretKey
    this.sessionToken = sessionToken
  }

  setAccessKey(accessKey: string) {
    this.accessKey = accessKey
  }

  getAccessKey() {
    return this.accessKey
  }

  setSecretKey(secretKey: string) {
    this.secretKey = secretKey
  }

  getSecretKey() {
    return this.secretKey
  }

  setSessionToken(sessionToken: string) {
    this.sessionToken = sessionToken
  }

  getSessionToken() {
    return this.sessionToken
  }

  get(): ICredentials {
    return {
      accessKey: this.accessKey,
      secretKey: this.secretKey,
      sessionToken: this.sessionToken,
    }
  }
}
