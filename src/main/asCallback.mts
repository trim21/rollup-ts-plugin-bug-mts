export function asCallback<T>(
  promise: Promise<T>,
  cb: ((err?: unknown, result?: T) => void) | undefined
): Promise<T> | void {
  if (cb === undefined) {
    return promise
  }

  promise.then(
    (result) => {
      cb(null, result)
    },
    (err) => {
      cb(err)
    }
  )
}
