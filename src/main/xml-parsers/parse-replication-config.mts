import { parseXml, toArray } from '../helpers.mts'

export function parseReplicationConfig(xml: string) {
  const xmlObj = parseXml(xml)

  const replicationConfig = {
    ReplicationConfiguration: {
      role: xmlObj.ReplicationConfiguration.Role,
      rules: toArray(xmlObj.ReplicationConfiguration.Rule),
    },
  }

  return replicationConfig
}
