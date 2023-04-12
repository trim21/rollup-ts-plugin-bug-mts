// check if typeof arg number
export function isNumber(arg: unknown): arg is number {
  return typeof arg === 'number'
}

// check if typeof arg function
export function isFunction(arg: unknown): arg is () => any {
  return typeof arg === 'function'
}

// check if typeof arg string
export function isString(arg: unknown): arg is string {
  return typeof arg === 'string'
}

// check if typeof arg object
export function isObject(arg: unknown): arg is object {
  return typeof arg === 'object' && arg !== null
}

// check if object is readable stream
export function isReadableStream(arg: unknown): arg is ReadableStream {
  // @ts-expect-error arg._read
  return isObject(arg) && isFunction(arg._read)
}

// check if arg is boolean
export function isBoolean(arg: unknown): arg is boolean {
  return typeof arg === 'boolean'
}

// check if arg is array
export function isArray(arg: unknown): arg is Array<unknown> {
  return Array.isArray(arg)
}

// check if arg is a valid date
export function isValidDate(arg: unknown): arg is Date {
  // @ts-expect-error isNaN(arg)
  return arg instanceof Date && !isNaN(arg)
}
