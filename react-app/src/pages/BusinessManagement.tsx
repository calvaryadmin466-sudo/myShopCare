import React, { useState, useRef } from 'react'
import { useBusiness } from '../contexts/BusinessContext'
import { useAuth } from '../contexts/AuthContext'
import { uploadBusinessLogo, deleteBusinessLogo } from '../lib/logoUpload'
import { Building2, Plus, Edit2, Trash2, X, Upload, Check } from 'lucide-react'

export default function BusinessManagement() {
  const { businesses, currentBusiness, createBusiness, updateBusiness, deleteBusiness, refreshBusinesses } = useBusiness()
  const { user } = useAuth()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingBusiness, setEditingBusiness] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: '',
    themeColor: '#3B82F6',
    currency: 'USD' as 'USD' | 'TZS' | 'KSH'
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const result = await createBusiness(formData.name, formData.themeColor, formData.currency)
      if (result.error) {
        setError(result.error)
      } else {
        setShowCreateModal(false)
        setFormData({ name: '', themeColor: '#3B82F6', currency: 'USD' })
        await refreshBusinesses()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBusiness) return

    setLoading(true)
    setError(null)

    try {
      const result = await updateBusiness(editingBusiness.id, {
        name: formData.name,
        theme_color: formData.themeColor,
        currency: formData.currency
      })
      if (result.error) {
        setError(result.error)
      } else {
        setShowEditModal(false)
        setEditingBusiness(null)
        setFormData({ name: '', themeColor: '#3B82F6', currency: 'USD' })
        await refreshBusinesses()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (businessId: string) => {
    if (!confirm('Are you sure you want to delete this business? This action cannot be undone.')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await deleteBusiness(businessId)
      if (result.error) {
        setError(result.error)
      } else {
        await refreshBusinesses()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = async (business: any, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const result = await uploadBusinessLogo(file, business.id)
      if (result.error) {
        setError(result.error)
      } else {
        // Update business with new logo URL
        await updateBusiness(business.id, { logo_url: result.url })
        await refreshBusinesses()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogoDelete = async (business: any) => {
    if (!confirm('Are you sure you want to remove the logo?')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      await deleteBusinessLogo(business.id)
      await updateBusiness(business.id, { logo_url: undefined })
      await refreshBusinesses()
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (business: any) => {
    setEditingBusiness(business)
    setFormData({
      name: business.name,
      themeColor: business.theme_color,
      currency: business.currency
    })
    setShowEditModal(true)
  }

  const colorOptions = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Management</h1>
          <p className="text-gray-600 mt-1">Manage your businesses and switch between them</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          Add Business
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {businesses.map((business) => (
          <div
            key={business.id}
            className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
              currentBusiness?.id === business.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'
            }`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {business.logo_url ? (
                    <img
                      src={business.logo_url}
                      alt={business.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: business.theme_color + '20' }}
                    >
                      <Building2 size={32} style={{ color: business.theme_color }} />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">{business.name}</h3>
                    <span className="text-sm text-gray-500">{business.currency}</span>
                  </div>
                </div>
                {currentBusiness?.id === business.id && (
                  <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                    Active
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-8 h-8 rounded-full"
                  style={{ backgroundColor: business.theme_color }}
                />
                <span className="text-sm text-gray-600">{business.theme_color}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(business)}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition"
                >
                  <Edit2 size={16} />
                  Edit
                </button>
                <label className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition cursor-pointer">
                  <Upload size={16} />
                  Logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoUpload(business, e)}
                  />
                </label>
                {business.logo_url && (
                  <button
                    onClick={() => handleLogoDelete(business)}
                    className="bg-red-100 text-red-700 px-3 py-2 rounded-lg hover:bg-red-200 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {business._role !== 'owner' && (
                <div className="mt-3 text-xs text-gray-500">
                  Role: {business._role}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Create New Business</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="My Business"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="TZS">TZS (TSh)</option>
                    <option value="KSH">KSH (KSh)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Theme Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, themeColor: color })}
                        className={`w-10 h-10 rounded-full transition ${
                          formData.themeColor === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={formData.themeColor}
                    onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                    className="mt-2 w-full h-10 rounded cursor-pointer"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Business'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingBusiness && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Edit Business</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="TZS">TZS (TSh)</option>
                    <option value="KSH">KSH (KSh)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Theme Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, themeColor: color })}
                        className={`w-10 h-10 rounded-full transition ${
                          formData.themeColor === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={formData.themeColor}
                    onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                    className="mt-2 w-full h-10 rounded cursor-pointer"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
