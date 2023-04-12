// parse XML response for listing in-progress multipart uploads
import * as errors from '../errors.mts'
import { parseXml, sanitizeObjectKey, toArray } from '../helpers.mts'
import { UploadID } from '../type.ts'

export function parseListMultipart(xml: string) {
  let result = {
    uploads: [] as {
      key: string
      uploadId: UploadID
      initiator: unknown
      owner: unknown
      storageClass: unknown
      initiated: unknown
    }[],
    prefixes: [] as { prefix: string }[],
    isTruncated: false,
    nextKeyMarker: undefined,
    nextUploadIdMarker: undefined,
  }

  let xmlobj = parseXml(xml)

  if (!xmlobj.ListMultipartUploadsResult) {
    throw new errors.InvalidXMLError('Missing tag: "ListMultipartUploadsResult"')
  }
  xmlobj = xmlobj.ListMultipartUploadsResult
  if (xmlobj.IsTruncated) {
    result.isTruncated = xmlobj.IsTruncated
  }
  if (xmlobj.NextKeyMarker) {
    result.nextKeyMarker = xmlobj.NextKeyMarker
  }
  if (xmlobj.NextUploadIdMarker) {
    result.nextUploadIdMarker = xmlobj.nextUploadIdMarker
  }

  if (xmlobj.CommonPrefixes) {
    toArray(xmlobj.CommonPrefixes).forEach((prefix) => {
      result.prefixes.push({ prefix: sanitizeObjectKey(toArray<string>(prefix.Prefix)[0]) })
    })
  }

  if (xmlobj.Upload) {
    toArray(xmlobj.Upload).forEach((upload) => {
      let key = upload.Key
      let uploadId = upload.UploadId
      let initiator = { id: upload.Initiator.ID, displayName: upload.Initiator.DisplayName }
      let owner = { id: upload.Owner.ID, displayName: upload.Owner.DisplayName }
      let storageClass = upload.StorageClass
      let initiated = new Date(upload.Initiated)
      result.uploads.push({ key, uploadId, initiator, owner, storageClass, initiated })
    })
  }
  return result
}
