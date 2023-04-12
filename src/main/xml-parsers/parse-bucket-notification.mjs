// parse XML response for bucket notification
import { parseXml, toArray } from '../helpers.mts'

export function parseBucketNotification(xml) {
  let result = {
    TopicConfiguration: [],
    QueueConfiguration: [],
    CloudFunctionConfiguration: [],
  }
  // Parse the events list
  let genEvents = function (events) {
    let result = []
    if (events) {
      toArray(events).forEach((s3event) => {
        result.push(s3event)
      })
    }
    return result
  }
  // Parse all filter rules
  let genFilterRules = function (filters) {
    let result = []
    if (filters) {
      filters = toArray(filters)
      if (filters[0].S3Key) {
        filters[0].S3Key = toArray(filters[0].S3Key)
        if (filters[0].S3Key[0].FilterRule) {
          toArray(filters[0].S3Key[0].FilterRule).forEach((rule) => {
            let Name = toArray(rule.Name)[0]
            let Value = toArray(rule.Value)[0]
            result.push({ Name, Value })
          })
        }
      }
    }
    return result
  }

  let xmlobj = parseXml(xml)
  xmlobj = xmlobj.NotificationConfiguration

  // Parse all topic configurations in the xml
  if (xmlobj.TopicConfiguration) {
    toArray(xmlobj.TopicConfiguration).forEach((config) => {
      let Id = toArray(config.Id)[0]
      let Topic = toArray(config.Topic)[0]
      let Event = genEvents(config.Event)
      let Filter = genFilterRules(config.Filter)
      result.TopicConfiguration.push({ Id, Topic, Event, Filter })
    })
  }
  // Parse all topic configurations in the xml
  if (xmlobj.QueueConfiguration) {
    toArray(xmlobj.QueueConfiguration).forEach((config) => {
      let Id = toArray(config.Id)[0]
      let Queue = toArray(config.Queue)[0]
      let Event = genEvents(config.Event)
      let Filter = genFilterRules(config.Filter)
      result.QueueConfiguration.push({ Id, Queue, Event, Filter })
    })
  }
  // Parse all QueueConfiguration arrays
  if (xmlobj.CloudFunctionConfiguration) {
    toArray(xmlobj.CloudFunctionConfiguration).forEach((config) => {
      let Id = toArray(config.Id)[0]
      let CloudFunction = toArray(config.CloudFunction)[0]
      let Event = genEvents(config.Event)
      let Filter = genFilterRules(config.Filter)
      result.CloudFunctionConfiguration.push({ Id, CloudFunction, Event, Filter })
    })
  }

  return result
}
