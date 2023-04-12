export default class Credentials {
  private accessKey: string
  private secretKey: string
  private sessionToken: string

  constructor({ accessKey, secretKey, sessionToken }: { accessKey: string; secretKey: string; sessionToken: string }) {
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

  get() {
    return {
      accessKey: this.accessKey,
      secretKey: this.secretKey,
      sessionToken: this.sessionToken,
    }
  }
}
