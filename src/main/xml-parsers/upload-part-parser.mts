import { parseXml } from '../helpers.mts'

export function uploadPartParser(xml: string) {
  const xmlObj = parseXml(xml)
  const respEl = xmlObj.CopyPartResult
  return respEl
}
