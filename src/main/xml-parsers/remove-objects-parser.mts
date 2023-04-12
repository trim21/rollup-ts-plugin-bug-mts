import { parseXml, toArray } from '../helpers.mts'

export function removeObjectsParser(xml: string) {
  const xmlObj = parseXml(xml)
  if (xmlObj.DeleteResult && xmlObj.DeleteResult.Error) {
    // return errors as array always. as the response is object in case of single object passed in removeObjects
    return toArray(xmlObj.DeleteResult.Error)
  }
  return []
}
