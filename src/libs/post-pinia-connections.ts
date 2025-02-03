const postPiniaConnections: (() => void)[] = []

/**
 * Add a function to be called after the pinia store is initialized
 * @param {() => void} setupFunction - The function to be called after the pinia store is initialized
 */
export const setupPostPiniaConnection = (setupFunction: () => void): void => {
  postPiniaConnections.push(setupFunction)
}

/**
 * Call all the functions added to the postPiniaConnections array
 */
export const setupPostPiniaConnections = (): void => {
  postPiniaConnections.forEach((setupFunction) => {
    setupFunction()
  })
}
