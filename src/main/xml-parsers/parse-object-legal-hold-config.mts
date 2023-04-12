import { parseXml } from '../helpers.mts'

export function parseObjectLegalHoldConfig(xml: string) {
  const xmlObj = parseXml(xml)
  return xmlObj.LegalHold
}
