// TODO: type this
type Event = unknown

// Base class for three supported configs.
export class TargetConfig {
  private Filter?: { S3Key: { FilterRule: { Name: string; Value: string }[] } }
  private Event?: Event[]
  private Id: any

  setId(id: any) {
    this.Id = id
  }

  addEvent(newevent: Event) {
    if (!this.Event) {
      this.Event = []
    }
    this.Event.push(newevent)
  }

  addFilterSuffix(suffix: string) {
    if (!this.Filter) {
      this.Filter = { S3Key: { FilterRule: [] } }
    }
    this.Filter.S3Key.FilterRule.push({ Name: 'suffix', Value: suffix })
  }

  addFilterPrefix(prefix: string) {
    if (!this.Filter) {
      this.Filter = { S3Key: { FilterRule: [] } }
    }
    this.Filter.S3Key.FilterRule.push({ Name: 'prefix', Value: prefix })
  }
}
