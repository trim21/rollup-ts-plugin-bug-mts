import { parseXml } from '../helpers.mts'

export function parseBucketVersioningConfig(xml: string) {
  let xmlObj = parseXml(xml)
  return xmlObj.VersioningConfiguration
}
