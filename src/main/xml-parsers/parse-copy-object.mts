// parse XML response for copy object
import * as errors from '../errors.mts'
import { parseXml } from '../helpers.mts'

export function parseCopyObject(xml: string) {
  let result: { etag: string; lastModified: string | Date } = {
    etag: '',
    lastModified: '',
  }

  let xmlobj = parseXml(xml)
  if (!xmlobj.CopyObjectResult) {
    throw new errors.InvalidXMLError('Missing tag: "CopyObjectResult"')
  }
  xmlobj = xmlobj.CopyObjectResult
  if (xmlobj.ETag) {
    result.etag = xmlobj.ETag.replace(/^"/g, '')
      .replace(/"$/g, '')
      .replace(/^&quot;/g, '')
      .replace(/&quot;$/g, '')
      .replace(/^&#34;/g, '')
      .replace(/&#34;$/g, '')
  }
  if (xmlobj.LastModified) {
    result.lastModified = new Date(xmlobj.LastModified)
  }

  return result
}
