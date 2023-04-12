import { isObject } from '../asserts.mts'
import { parseXml, sanitizeETag, sanitizeObjectKey, toArray } from '../helpers.mts'

const formatObjInfo = (content, opts = {}) => {
  let { Key, LastModified, ETag, Size, VersionId, IsLatest } = content

  if (!isObject(opts)) {
    opts = {}
  }

  const name = sanitizeObjectKey(toArray(Key)[0])
  const lastModified = new Date(toArray(LastModified)[0])
  const etag = sanitizeETag(toArray(ETag)[0])

  return {
    name,
    lastModified,
    etag,
    size: Size,
    versionId: VersionId,
    isLatest: IsLatest,
    isDeleteMarker: opts.IsDeleteMarker ? opts.IsDeleteMarker : false,
  }
}

// parse XML response for list objects in a bucket
export function parseListObjects(xml) {
  let result = {
    objects: [],
    isTruncated: false,
  }
  let isTruncated = false
  let nextMarker, nextVersionKeyMarker
  const xmlobj = parseXml(xml)

  const parseCommonPrefixesEntity = (responseEntity) => {
    if (responseEntity) {
      toArray(responseEntity).forEach((commonPrefix) => {
        result.objects.push({ prefix: sanitizeObjectKey(toArray(commonPrefix.Prefix)[0]), size: 0 })
      })
    }
  }

  const listBucketResult = xmlobj.ListBucketResult
  const listVersionsResult = xmlobj.ListVersionsResult

  if (listBucketResult) {
    if (listBucketResult.IsTruncated) {
      isTruncated = listBucketResult.IsTruncated
    }
    if (listBucketResult.Contents) {
      toArray(listBucketResult.Contents).forEach((content) => {
        const name = sanitizeObjectKey(toArray(content.Key)[0])
        const lastModified = new Date(toArray(content.LastModified)[0])
        const etag = sanitizeETag(toArray(content.ETag)[0])
        const size = content.Size
        result.objects.push({ name, lastModified, etag, size })
      })
    }

    if (listBucketResult.NextMarker) {
      nextMarker = listBucketResult.NextMarker
    }
    parseCommonPrefixesEntity(listBucketResult.CommonPrefixes)
  }

  if (listVersionsResult) {
    if (listVersionsResult.IsTruncated) {
      isTruncated = listVersionsResult.IsTruncated
    }

    if (listVersionsResult.Version) {
      toArray(listVersionsResult.Version).forEach((content) => {
        result.objects.push(formatObjInfo(content))
      })
    }
    if (listVersionsResult.DeleteMarker) {
      toArray(listVersionsResult.DeleteMarker).forEach((content) => {
        result.objects.push(formatObjInfo(content, { IsDeleteMarker: true }))
      })
    }

    if (listVersionsResult.NextKeyMarker) {
      nextVersionKeyMarker = listVersionsResult.NextKeyMarker
    }
    if (listVersionsResult.NextVersionIdMarker) {
      result.versionIdMarker = listVersionsResult.NextVersionIdMarker
    }
    parseCommonPrefixesEntity(listVersionsResult.CommonPrefixes)
  }

  result.isTruncated = isTruncated
  if (isTruncated) {
    result.nextMarker = nextVersionKeyMarker || nextMarker
  }
  return result
}
