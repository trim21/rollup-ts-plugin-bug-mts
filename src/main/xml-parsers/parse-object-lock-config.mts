import { parseXml, RETENTION_VALIDITY_UNITS } from '../helpers.mts'

type R = {
  mode?: string
  objectLockEnabled?: 'Enabled'
  unit?: 'Years' | 'Days'
  validity?: number
}

export function parseObjectLockConfig(xml: string): R | undefined {
  const xmlObj = parseXml(xml)
  let lockConfigResult: R = {}
  if (xmlObj.ObjectLockConfiguration) {
    lockConfigResult = {
      objectLockEnabled: xmlObj.ObjectLockConfiguration.ObjectLockEnabled,
    }
    let retentionResp
    if (
      xmlObj.ObjectLockConfiguration &&
      xmlObj.ObjectLockConfiguration.Rule &&
      xmlObj.ObjectLockConfiguration.Rule.DefaultRetention
    ) {
      retentionResp = xmlObj.ObjectLockConfiguration.Rule.DefaultRetention || {}
      lockConfigResult.mode = retentionResp.Mode
    }
    if (retentionResp) {
      const isUnitYears = retentionResp.Years
      if (isUnitYears) {
        lockConfigResult.validity = isUnitYears
        lockConfigResult.unit = RETENTION_VALIDITY_UNITS.YEARS
      } else {
        lockConfigResult.validity = retentionResp.Days
        lockConfigResult.unit = RETENTION_VALIDITY_UNITS.DAYS
      }
    }
    return lockConfigResult
  }
}
