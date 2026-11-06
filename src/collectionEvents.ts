// Notify data consumers only after a collection mutation has succeeded.
export const COLLECTION_CHANGED = 'atypibrick:collection-changed'

export async function collectionMutation<T>(operation: Promise<T>): Promise<T> {
  const result = await operation
  window.dispatchEvent(new Event(COLLECTION_CHANGED))
  return result
}
