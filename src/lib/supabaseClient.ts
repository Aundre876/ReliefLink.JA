import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cstujzqlelwxerrbpsqc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdHVqenFsZWx3eGVycmJwc3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTI4ODgsImV4cCI6MjA4OTA2ODg4OH0.ymj1XREH5Mra0A-cPUbhHbXeZYCHV2BYv8ObAJHJjX8';


export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
