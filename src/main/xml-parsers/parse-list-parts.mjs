// parse XML response for list parts of an in progress multipart upload
import * as errors from '../errors.mts'
import { parseXml, toArray } from '../helpers.mts'

export function parseListParts(xml) {
  let xmlobj = parseXml(xml)
  let result = {
    isTruncated: false,
    parts: [],
    marker: undefined,
  }
  if (!xmlobj.ListPartsResult) {
    throw new errors.InvalidXMLError('Missing tag: "ListPartsResult"')
  }
  xmlobj = xmlobj.ListPartsResult
  if (xmlobj.IsTruncated) {
    result.isTruncated = xmlobj.IsTruncated
  }
  if (xmlobj.NextPartNumberMarker) {
    result.marker = +toArray(xmlobj.NextPartNumberMarker)[0]
  }
  if (xmlobj.Part) {
    toArray(xmlobj.Part).forEach((p) => {
      let part = +toArray(p.PartNumber)[0]
      let lastModified = new Date(p.LastModified)
      let etag = p.ETag.replace(/^"/g, '')
        .replace(/"$/g, '')
        .replace(/^&quot;/g, '')
        .replace(/&quot;$/g, '')
        .replace(/^&#34;/g, '')
        .replace(/&#34;$/g, '')
      result.parts.push({ part, lastModified, etag })
    })
  }
  return result
}
