import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const supabaseUrl = 'https://avrqojegjalzeskmhsgr.supabase.co'
const supabaseKey = 'sb_publishable_WuFrFn5WFwXT5xdRC8U_ow_ySy2Li6W'

export const supabase = createClient(supabaseUrl, supabaseKey)
