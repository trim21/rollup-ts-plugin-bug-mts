// parse XML response when a new multipart upload is initiated
import * as errors from '../errors.mts'
import { parseXml } from '../helpers.mts'

export function parseInitiateMultipart(xml: string) {
  let xmlobj = parseXml(xml)

  if (!xmlobj.InitiateMultipartUploadResult) {
    throw new errors.InvalidXMLError('Missing tag: "InitiateMultipartUploadResult"')
  }
  xmlobj = xmlobj.InitiateMultipartUploadResult

  if (xmlobj.UploadId) {
    return xmlobj.UploadId
  }
  throw new errors.InvalidXMLError('Missing tag: "UploadId"')
}
