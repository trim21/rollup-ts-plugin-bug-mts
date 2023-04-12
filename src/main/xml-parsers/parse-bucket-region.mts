// parse XML response for bucket region
import { parseXml } from '../helpers.mts'

export function parseBucketRegion(xml: string) {
  // return region information
  return parseXml(xml).LocationConstraint
}
