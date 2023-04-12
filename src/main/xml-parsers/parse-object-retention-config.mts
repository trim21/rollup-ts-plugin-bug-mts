import { parseXml } from '../helpers.mts'

export function parseObjectRetentionConfig(xml: string) {
  const xmlObj = parseXml(xml)
  const retentionConfig = xmlObj.Retention

  return {
    mode: retentionConfig.Mode,
    retainUntilDate: retentionConfig.RetainUntilDate,
  }
}
