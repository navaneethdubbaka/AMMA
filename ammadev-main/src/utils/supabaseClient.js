import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://chlfrkennmepvlqfsfzy.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNobGZya2Vubm1lcHZscWZzZnp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODcxMzYsImV4cCI6MjA3ODU2MzEzNn0.z0E4pfRm6gl3gMxsdDgoXFnokSD9UyxdQi9zzBCBO4Y"

export const supabase = createClient(supabaseUrl, supabaseKey)

