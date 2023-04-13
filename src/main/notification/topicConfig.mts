// 1. Topic (simple notification service)
import { TargetConfig } from './targetConfig.mts'

export class TopicConfig extends TargetConfig {
  private Topic: string

  constructor(arn: string) {
    super()
    this.Topic = arn
  }
}
