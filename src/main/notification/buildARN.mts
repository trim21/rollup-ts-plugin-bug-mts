export const buildARN = (partition: string, service: string, region: string, accountId: string, resource: string) => {
  return 'arn:' + partition + ':' + service + ':' + region + ':' + accountId + ':' + resource
}
