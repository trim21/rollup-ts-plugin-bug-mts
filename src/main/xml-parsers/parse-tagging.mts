import { isObject } from '../asserts.mts'
import { parseXml } from '../helpers.mts'

export function parseTagging(xml: string) {
  const xmlObj = parseXml(xml)
  let result = []
  if (xmlObj.Tagging && xmlObj.Tagging.TagSet && xmlObj.Tagging.TagSet.Tag) {
    const tagResult = xmlObj.Tagging.TagSet.Tag
    // if it is a single tag convert into an array so that the return value is always an array.
    if (isObject(tagResult)) {
      result.push(tagResult)
    } else {
      result = tagResult
    }
  }
  return result
}
