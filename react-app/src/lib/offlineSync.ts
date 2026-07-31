import { supabase } from './supabase'
import { indexedDB, STORES_CONST } from './indexedDB'
import type { OfflineSyncItem } from '../types'

class OfflineSync {
  private isOnline: boolean = true
  private syncInterval: ReturnType<typeof setInterval> | null = null
  private syncInProgress: boolean = false

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine
      window.addEventListener('online', () => this.handleOnline())
      window.addEventListener('offline', () => this.handleOffline())
    }
  }

  private handleOnline() {
    this.isOnline = true
    console.log('Back online - starting sync')
    this.syncPendingItems()
  }

  private handleOffline() {
    this.isOnline = false
    console.log('Gone offline - using local cache')
  }

  getOnlineStatus(): boolean {
    return this.isOnline
  }

  // Queue an operation for offline sync
  async queueOperation(
    businessId: string,
    userId: string,
    tableName: string,
    operation: 'insert' | 'update' | 'delete',
    recordData: any,
    recordId?: string
  ): Promise<void> {
    const syncItem: OfflineSyncItem = {
      id: crypto.randomUUID(),
      business_id: businessId,
      user_id: userId,
      table_name: tableName,
      operation,
      record_id: recordId,
      record_data: recordData,
      created_at: new Date().toISOString(),
      sync_status: 'pending'
    }

    // Store in IndexedDB
    await indexedDB.put(STORES_CONST.syncQueue, {
      id: syncItem.id,
      business_id: businessId,
      data: syncItem,
      timestamp: Date.now()
    })

    // If online, try to sync immediately
    if (this.isOnline) {
      this.syncPendingItems()
    }
  }

  // Sync all pending items
  async syncPendingItems(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) return

    this.syncInProgress = true
    console.log('Starting offline sync...')

    try {
      const pendingItems = await indexedDB.getAll(STORES_CONST.syncQueue)
      
      for (const item of pendingItems) {
        const syncItem = item.data as OfflineSyncItem
        if (syncItem.sync_status !== 'pending') continue

        try {
          await this.syncItem(syncItem)
          
          // Update sync status
          syncItem.sync_status = 'synced'
          syncItem.synced_at = new Date().toISOString()
          
          await indexedDB.put(STORES_CONST.syncQueue, {
            id: syncItem.id,
            business_id: syncItem.business_id,
            data: syncItem,
            timestamp: Date.now()
          })
          
          // Remove from queue after successful sync
          await indexedDB.delete(STORES_CONST.syncQueue, syncItem.id)
          
          // Also sync to Supabase offline_sync_queue table
          await supabase.from('offline_sync_queue').upsert({
            id: syncItem.id,
            business_id: syncItem.business_id,
            user_id: syncItem.user_id,
            table_name: syncItem.table_name,
            operation: syncItem.operation,
            record_id: syncItem.record_id,
            record_data: syncItem.record_data,
            sync_status: 'synced',
            synced_at: new Date().toISOString()
          })
        } catch (error) {
          console.error('Failed to sync item:', syncItem.id, error)
          
          // Mark as failed
          syncItem.sync_status = 'failed'
          await indexedDB.put(STORES_CONST.syncQueue, {
            id: syncItem.id,
            business_id: syncItem.business_id,
            data: syncItem,
            timestamp: Date.now()
          })
        }
      }
    } catch (error) {
      console.error('Error during sync:', error)
    } finally {
      this.syncInProgress = false
    }
  }

  private async syncItem(item: OfflineSyncItem): Promise<void> {
    const { table_name, operation, record_data, record_id } = item

    switch (operation) {
      case 'insert':
        await supabase.from(table_name).insert(record_data)
        break
      case 'update':
        if (record_id) {
          await supabase.from(table_name).update(record_data).eq('id', record_id)
        }
        break
      case 'delete':
        if (record_id) {
          await supabase.from(table_name).delete().eq('id', record_id)
        }
        break
    }
  }

  // Cache data from Supabase to IndexedDB
  async cacheData(tableName: string, businessId: string): Promise<void> {
    if (!this.isOnline) return

    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('business_id', businessId)

      if (error) throw error

      // Clear existing cachefor this business
      await indexedDB.clearStore(tableName as any, businessId)

      // Cache new data
      if (data) {
        await Promise.all(
          data.map(record =>
            indexedDB.put(tableName as any, {
              id: record.id,
              business_id: businessId,
              data: record,
              timestamp: Date.now()
            })
          )
        )
      }
    } catch (error) {
      console.error(`Error caching ${tableName}:`, error)
    }
  }

  // Get data from cache or Supabase
  async getData(tableName: string, businessId: string): Promise<any[]> {
    // Try cache first
    const cached = await indexedDB.getAll(tableName as any, businessId)
    
    if (cached.length > 0) {
      return cached.map(item => item.data)
    }

    // If no cache and online, fetch from Supabase
    if (this.isOnline) {
      await this.cacheData(tableName, businessId)
      const fresh = await indexedDB.getAll(tableName as any, businessId)
      return fresh.map(item => item.data)
    }

    return []
  }

  // Start periodic sync (every 30 seconds)
  startPeriodicSync(): void {
    if (this.syncInterval) return
    
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncPendingItems()
      }
    }, 30000)
  }

  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }
}

export const offlineSync = new OfflineSync()
