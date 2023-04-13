// backward compatible, use ts type for futures

export const ObjectCreatedAll = 's3:ObjectCreated:*'
export const ObjectCreatedPut = 's3:ObjectCreated:Put'
export const ObjectCreatedPost = 's3:ObjectCreated:Post'
export const ObjectCreatedCopy = 's3:ObjectCreated:Copy'
export const ObjectCreatedCompleteMultipartUpload = 's3:ObjectCreated:CompleteMultipartUpload'
export const ObjectRemovedAll = 's3:ObjectRemoved:*'
export const ObjectRemovedDelete = 's3:ObjectRemoved:Delete'
export const ObjectRemovedDeleteMarkerCreated = 's3:ObjectRemoved:DeleteMarkerCreated'
export const ObjectReducedRedundancyLostObject = 's3:ReducedRedundancyLostObject'

export type NotificationEvent =
  | 's3:ObjectCreated:*'
  | 's3:ObjectCreated:Put'
  | 's3:ObjectCreated:Post'
  | 's3:ObjectCreated:Copy'
  | 's3:ObjectCreated:CompleteMultipartUpload'
  | 's3:ObjectRemoved:*'
  | 's3:ObjectRemoved:Delete'
  | 's3:ObjectRemoved:DeleteMarkerCreated'
  | 's3:ReducedRedundancyLostObject'
  | 's3:TestEvent'
  | 's3:ObjectRestore:Post'
  | 's3:ObjectRestore:Completed'
  | 's3:Replication:OperationFailedReplication'
  | 's3:Replication:OperationMissedThreshold'
  | 's3:Replication:OperationReplicatedAfterThreshold'
  | 's3:Replication:OperationNotTracked'
  | string
// put string at least so auto-complete could work
