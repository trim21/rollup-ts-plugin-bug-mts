// parse XML response to list all the owned buckets
import * as errors from '../errors.mts'
import { parseXml, toArray } from '../helpers.mts'
import type { BucketItemFromList } from "../minio.d.ts"

export function parseListBucket(xml: string): BucketItemFromList[] {
  let result: BucketItemFromList[] = []
  let xmlobj = parseXml(xml)

  if (!xmlobj.ListAllMyBucketsResult) {
    throw new errors.InvalidXMLError('Missing tag: "ListAllMyBucketsResult"')
  }
  xmlobj = xmlobj.ListAllMyBucketsResult

  if (xmlobj.Buckets) {
    if (xmlobj.Buckets.Bucket) {
      toArray(xmlobj.Buckets.Bucket).forEach((bucket) => {
        let name = bucket.Name
        let creationDate = new Date(bucket.CreationDate)
        result.push({ name, creationDate })
      })
    }
  }
  return result
}
