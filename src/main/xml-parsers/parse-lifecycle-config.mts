import { parseXml } from '../helpers.mts'

export function parseLifecycleConfig(xml: string) {
  const xmlObj = parseXml(xml)
  return xmlObj.LifecycleConfiguration
}
