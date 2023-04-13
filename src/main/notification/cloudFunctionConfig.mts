// 3. CloudFront (lambda function)
import { TargetConfig } from './targetConfig.mjs'

export class CloudFunctionConfig extends TargetConfig {
  private CloudFunction: string

  constructor(arn: string) {
    super()
    this.CloudFunction = arn
  }
}
