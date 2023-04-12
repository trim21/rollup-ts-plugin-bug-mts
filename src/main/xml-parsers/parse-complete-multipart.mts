// parse XML response when a multipart upload is completed
import { parseXml, toArray } from '../helpers.mts'

export function parseCompleteMultipart(xml: string) {
  let xmlobj = parseXml(xml).CompleteMultipartUploadResult
  if (xmlobj.Location) {
    let location = toArray(xmlobj.Location)[0]
    let bucket = toArray(xmlobj.Bucket)[0]
    let key = xmlobj.Key
    let etag = xmlobj.ETag.replace(/^"/g, '')
      .replace(/"$/g, '')
      .replace(/^&quot;/g, '')
      .replace(/&quot;$/g, '')
      .replace(/^&#34;/g, '')
      .replace(/&#34;$/g, '')

    return { location, bucket, key, etag }
  }
  // Complete Multipart can return XML Error after a 200 OK response
  if (xmlobj.Code && xmlobj.Message) {
    let errCode = toArray(xmlobj.Code)[0]
    let errMessage = toArray(xmlobj.Message)[0]
    return { errCode, errMessage }
  }
}
