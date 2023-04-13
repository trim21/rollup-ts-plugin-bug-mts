// Notification config - array of target configs.
// Target configs can be
// 1. Topic (simple notification service)
// 2. Queue (simple queue service)
// 3. CloudFront (lambda function)
import { CloudFunctionConfig } from './cloudFunctionConfig.mts'
import { QueueConfig } from './queueConfig.mts'
import { TargetConfig } from './targetConfig.mts'
import { TopicConfig } from './topicConfig.mts'

export class NotificationConfig {
  private TopicConfiguration?: TargetConfig[]
  private CloudFunctionConfiguration?: TargetConfig[]
  private QueueConfiguration?: TargetConfig[]

  add(target: TargetConfig) {
    let instance: TargetConfig[] | undefined
    if (target instanceof TopicConfig) {
      instance = this.TopicConfiguration ??= []
    }
    if (target instanceof QueueConfig) {
      instance = this.QueueConfiguration ??= []
    }
    if (target instanceof CloudFunctionConfig) {
      instance = this.CloudFunctionConfiguration ??= []
    }
    if (instance) {
      instance.push(target)
    }
  }
}
