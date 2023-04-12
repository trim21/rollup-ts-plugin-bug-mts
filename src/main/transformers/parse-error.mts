// Parse XML and return information as Javascript types
import { XMLParser } from 'fast-xml-parser'

import * as errors from '../errors.mts'

const fxp = new XMLParser()

// parse error XML response
export function parseError(xml: string, headerInfo: Record<string, any>) {
  let xmlErr = {}
  let xmlObj = fxp.parse(xml)
  if (xmlObj.Error) {
    xmlErr = xmlObj.Error
  }

  let e = new errors.S3Error() as unknown as Record<string, any>
  Object.entries(xmlErr).forEach(([key, value]) => {
    e[key.toLowerCase()] = value
  })

  Object.entries(headerInfo).forEach(([key, value]) => {
    e[key] = value
  })

  return e
}
