import { supabase } from './supabase'

const BUCKET_NAME = 'business-logos'

export async function uploadBusinessLogo(
  file: File,
  businessId: string
): Promise<{ error: string | null; url?: string }> {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return { error: 'File must be an image' }
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { error: 'File size must be less than 5MB' }
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${businessId}/${Date.now()}.${fileExt}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return { error: uploadError.message || 'Failed to upload logo' }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName)

    return { error: null, url: urlData.publicUrl }
  } catch (error: any) {
    console.error('Logo upload error:', error)
    return { error: error.message || 'Failed to upload logo' }
  }
}

export async function deleteBusinessLogo(businessId: string): Promise<{ error: string | null }> {
  try {
    // List all files for this business
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(businessId)

    if (listError) {
      console.error('List error:', listError)
      return { error: listError.message || 'Failed to delete logo' }
    }

    // Delete all files for this business
    if (files && files.length > 0) {
      const filePaths = files.map(file => `${businessId}/${file.name}`)
      
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(filePaths)

      if (deleteError) {
        console.error('Delete error:', deleteError)
        return { error: deleteError.message || 'Failed to delete logo' }
      }
    }

    return { error: null }
  } catch (error: any) {
    console.error('Logo delete error:', error)
    return { error: error.message || 'Failed to delete logo' }
  }
}

export async function getBusinessLogoUrl(businessId: string): Promise<string | null> {
  try {
    // List files for this business
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(businessId)

    if (listError || !files || files.length === 0) {
      return null
    }

    // Get the most recent file
    const latestFile = files.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    const filePath = `${businessId}/${latestFile.name}`

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath)

    return urlData.publicUrl
  } catch (error) {
    console.error('Error getting logo URL:', error)
    return null
  }
}
