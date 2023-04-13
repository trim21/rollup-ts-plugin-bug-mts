// 2. Queue (simple queue service)
import { TargetConfig } from './targetConfig.mts'

export class QueueConfig extends TargetConfig {
  private Queue: string

  constructor(arn: string) {
    super()
    this.Queue = arn
  }
}
