/**
 * Optimistic Updates — apply changes immediately, roll back on error.
 * The UI never waits for the network round-trip.
 */

import { toast } from 'react-hot-toast'

/**
 * Optimistically adds an item to a local list, then persists to Supabase.
 * If the DB write fails, the item is removed and an error toast shows.
 *
 * Usage:
 *   const result = await optimisticAdd(
 *     products, setProducts,
 *     () => supabase.from('products').insert(newProduct).select().single(),
 *     { ...newProduct, id: crypto.randomUUID() }, // optimistic item
 *     'Product added',
 *   )
 */
export async function optimisticAdd<T extends { id: string }>(
  currentList: T[],
  setList: (items: T[]) => void,
  dbCall: () => Promise<{ data: T | null; error: any }>,
  optimisticItem: T,
  successMessage: string,
): Promise<boolean> {
  // 1. Apply optimistically — UI updates immediately
  setList([optimisticItem, ...currentList])
  toast.success(successMessage)

  // 2. Persist to DB
  try {
    const { data, error } = await dbCall()
    if (error) throw error

    // 3. Replace optimistic item with the real DB item (has real ID/timestamps)
    if (data) {
      setList(currentList.map((item) => item.id === optimisticItem.id ? data : item))
    }
    return true
  } catch (err) {
    // 4. Rollback — remove the optimistic item
    setList(currentList.filter((item) => item.id !== optimisticItem.id))
    toast.error(`Failed: ${err instanceof Error ? err.message : 'Network error'}`)
    return false
  }
}

/**
 * Optimistically updates an item, rolls back on error.
 */
export async function optimisticUpdate<T extends { id: string }>(
  currentList: T[],
  setList: (items: T[]) => void,
  dbCall: () => Promise<{ error: any }>,
  id: string,
  changes: Partial<T>,
  successMessage?: string,
): Promise<boolean> {
  const original = currentList.find((item) => item.id === id)
  if (!original) return false

  // 1. Apply optimistically
  setList(currentList.map((item) => item.id === id ? { ...item, ...changes } : item))
  if (successMessage) toast.success(successMessage)

  // 2. Persist
  try {
    const { error } = await dbCall()
    if (error) throw error
    return true
  } catch (err) {
    // 3. Rollback
    setList(currentList.map((item) => item.id === id ? original : item))
    toast.error(`Failed: ${err instanceof Error ? err.message : 'Network error'}`)
    return false
  }
}

/**
 * Optimistically removes an item, rolls back on error.
 */
export async function optimisticRemove<T extends { id: string }>(
  currentList: T[],
  setList: (items: T[]) => void,
  dbCall: () => Promise<{ error: any }>,
  id: string,
  successMessage: string,
): Promise<boolean> {
  const original = currentList.find((item) => item.id === id)
  if (!original) return false

  // 1. Remove optimistically
  setList(currentList.filter((item) => item.id !== id))
  toast.success(successMessage)

  // 2. Persist
  try {
    const { error } = await dbCall()
    if (error) throw error
    return true
  } catch (err) {
    // 3. Rollback — put it back
    setList([original, ...currentList])
    toast.error(`Failed: ${err instanceof Error ? err.message : 'Network error'}`)
    return false
  }
}
