// IndexedDB wrapper for offline data caching
const DB_NAME = 'myShopCareDB'
const DB_VERSION = 1
const STORES = {
  products: 'products',
  sales: 'sales',
  customers: 'customers',
  expenses: 'expenses',
  debts: 'debts',
  syncQueue: 'syncQueue'
} as const

type StoreName = typeof STORES[keyof typeof STORES]

interface DBRecord {
  id: string
  business_id: string
  data: any
  timestamp: number
}

class IndexedDB {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise
    if (this.db) return

    this.initPromise = new Promise((resolve, reject) => {
      const request = (window.indexedDB as IDBFactory).open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object stores for each data type
        Object.values(STORES).forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id' })
            store.createIndex('business_id', 'business_id', { unique: false })
            store.createIndex('timestamp', 'timestamp', { unique: false })
          }
        })
      }
    })

    return this.initPromise
  }

  private async getStore(storeName: StoreName, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    const transaction = this.db.transaction(storeName, mode)
    return transaction.objectStore(storeName)
  }

  async put(storeName: StoreName, record: DBRecord): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(record)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async get(storeName: StoreName, id: string): Promise<DBRecord | undefined> {
    const store = await this.getStore(storeName, 'readonly')
    return new Promise((resolve, reject) => {
      const request = store.get(id)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async getAll(storeName: StoreName, businessId?: string): Promise<DBRecord[]> {
    const store = await this.getStore(storeName, 'readonly')
    return new Promise((resolve, reject) => {
      const request = businessId 
        ? store.index('business_id').getAll(businessId)
        : store.getAll()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  }

  async delete(storeName: StoreName, id: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.delete(id)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async clearStore(storeName: StoreName, businessId?: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite')
    
    if (businessId) {
      // Delete only records for specific business
      const records = await this.getAll(storeName, businessId)
      await Promise.all(records.map(record => this.delete(storeName, record.id)))
    } else {
      // Clear entire store
      return new Promise((resolve, reject) => {
        const request = store.clear()
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })
    }
  }

  async clearBusinessData(businessId: string): Promise<void> {
    await Promise.all(
      Object.values(STORES).map(storeName => this.clearStore(storeName as StoreName, businessId))
    )
  }
}

export const indexedDB = new IndexedDB()
export const STORES_CONST = STORES
