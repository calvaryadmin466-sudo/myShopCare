class SystemNotifications {
  private permission: NotificationPermission = 'default'
  private isEnabled: boolean = false

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permission = Notification.permission
      this.isEnabled = this.permission === 'granted'
    }
  }

  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('System notifications are not supported in this browser')
      return false
    }

    if (this.permission === 'granted') {
      this.isEnabled = true
      return true
    }

    if (this.permission !== 'denied') {
      const result = await Notification.requestPermission()
      this.permission = result
      this.isEnabled = result === 'granted'
      return this.isEnabled
    }

    return false
  }

  showNotification(title: string, options?: NotificationOptions): void {
    if (!this.isEnabled || typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    try {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      })
    } catch (error) {
      console.error('Error showing system notification:', error)
    }
  }

  showLowStockNotification(productName: string, currentStock: number, threshold: number): void {
    this.showNotification('Low Stock Alert', {
      body: `${productName} is running low! Current stock: ${currentStock} (Threshold: ${threshold})`,
      tag: `low-stock-${productName}`,
      requireInteraction: true
    })
  }

  showDebtReminderNotification(customerName: string, amount: number, currency: string): void {
    this.showNotification('Debt Payment Reminder', {
      body: `${customerName} has an outstanding debt of ${currency} ${amount.toLocaleString()}`,
      tag: `debt-${customerName}`,
      requireInteraction: false
    })
  }

  showSaleNotification(total: number, currency: string): void {
    this.showNotification('New Sale Recorded', {
      body: `Sale of ${currency} ${total.toLocaleString()} has been recorded`,
      tag: 'sale',
      requireInteraction: false
    })
  }

  showBusinessSwitchNotification(businessName: string): void {
    this.showNotification('Business Switched', {
      body: `Switched to ${businessName}`,
      tag: 'business-switch',
      requireInteraction: false
    })
  }

  isPermissionGranted(): boolean {
    return this.permission === 'granted'
  }

  isPermissionDenied(): boolean {
    return this.permission === 'denied'
  }

  isPermissionDefault(): boolean {
    return this.permission === 'default'
  }
}

export const systemNotifications = new SystemNotifications()
