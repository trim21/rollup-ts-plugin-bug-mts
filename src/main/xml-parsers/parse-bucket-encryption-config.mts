import { parseXml } from '../helpers.mts'

export function parseBucketEncryptionConfig(xml: string) {
  return parseXml(xml)
}
