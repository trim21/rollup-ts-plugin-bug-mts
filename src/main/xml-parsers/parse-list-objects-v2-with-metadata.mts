// parse XML response for list objects v2 with metadata in a bucket
import * as errors from '../errors.mts'
import { parseXml, sanitizeETag, sanitizeObjectKey, toArray } from '../helpers.mts'

export function parseListObjectsV2WithMetadata(xml: string) {
  let result = {
    objects: [],
    isTruncated: false,
  }
  let xmlobj = parseXml(xml)
  if (!xmlobj.ListBucketResult) {
    throw new errors.InvalidXMLError('Missing tag: "ListBucketResult"')
  }
  xmlobj = xmlobj.ListBucketResult
  if (xmlobj.IsTruncated) {
    result.isTruncated = xmlobj.IsTruncated
  }
  if (xmlobj.NextContinuationToken) {
    result.nextContinuationToken = xmlobj.NextContinuationToken
  }

  if (xmlobj.Contents) {
    toArray(xmlobj.Contents).forEach((content) => {
      let name = sanitizeObjectKey(content.Key)
      let lastModified = new Date(content.LastModified)
      let etag = sanitizeETag(content.ETag)
      let size = content.Size
      let metadata
      if (content.UserMetadata != null) {
        metadata = toArray(content.UserMetadata)[0]
      } else {
        metadata = null
      }
      result.objects.push({ name, lastModified, etag, size, metadata })
    })
  }

  if (xmlobj.CommonPrefixes) {
    toArray(xmlobj.CommonPrefixes).forEach((commonPrefix) => {
      result.objects.push({ prefix: sanitizeObjectKey(toArray(commonPrefix.Prefix)[0]), size: 0 })
    })
  }
  return result
}
