export type Platform_role = 'super_admin' | 'user'
export type TenantRole = 'admin' | 'secretary' | 'member'
export type Plan = 'trial' | 'starter' | 'pro' | 'district'
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete'
export type Degree = 'EA' | 'FC' | 'MM'
export type DuesStatus = 'paid' | 'due' | 'exempt'
export type PetitionStatus = 'new' | 'under_review' | 'approved' | 'denied'
export type EventType = 'degree' | 'stated_communication' | 'grand_lodge' | 'social' | 'other'
export type AccessLevel = 'all' | 'EA' | 'FC' | 'MM'
export type RecipientGroup = 'all' | 'mm_only' | 'candidates' | 'dues_outstanding'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'
export type BillingCycle = 'monthly' | 'annual'

export interface Tenant {
  id: string
  created_at: string
  updated_at: string
  name: string
  number: string
  slug: string
  address?: string
  city?: string
  state?: string
  zip?: string
  email?: string
  phone?: string
  website?: string
  primary_color: string
  secondary_color: string
  logo_url?: string
  plan: Plan
  stripe_customer_id?: string
  stripe_subscription_id?: string
  subscription_status: SubscriptionStatus
  trial_ends_at?: string
  billing_cycle: BillingCycle
  dues_amount: number
  dues_due_month: number
  timezone: string
  is_active: boolean
  rite: string
  jurisdiction?: string
  about_text?: string
  history_text?: string
  meeting_schedule?: string
  member_count: number
  onboarding_complete: boolean
}

export interface Profile {
  id: string
  created_at: string
  updated_at: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  avatar_url?: string
  platform_role: Platform_role
  onboarding_complete: boolean
}

export interface TenantMember {
  id: string
  created_at: string
  tenant_id: string
  user_id: string
  degree: Degree
  lodge_role?: string
  dues_status: DuesStatus
  dues_paid_at?: string
  dues_year: number
  is_active: boolean
  joined_date?: string
  notes?: string
  tenant_role: TenantRole
  profile?: Profile
}

export interface LodgeEvent {
  id: string
  created_at: string
  tenant_id: string
  title: string
  event_date: string
  event_time?: string
  location?: string
  description?: string
  dress_code?: string
  is_public: boolean
  event_type: EventType
  created_by?: string
}

export interface Petition {
  id: string
  created_at: string
  tenant_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  age?: number
  occupation?: string
  believes_in_supreme_being?: boolean
  reason?: string
  referred_by?: string
  status: PetitionStatus
  reviewed_by?: string
  reviewed_at?: string
  notes?: string
}

export interface Payment {
  id: string
  created_at: string
  tenant_id: string
  member_id: string
  amount: number
  currency: string
  stripe_payment_intent_id?: string
  stripe_session_id?: string
  status: PaymentStatus
  dues_year?: number
  description?: string
  receipt_url?: string
  profile?: Profile
}

export interface PlatformSubscription {
  id: string
  created_at: string
  tenant_id: string
  stripe_subscription_id?: string
  stripe_customer_id?: string
  plan: Plan
  billing_cycle: BillingCycle
  status: SubscriptionStatus
  current_period_start?: string
  current_period_end?: string
  cancel_at_period_end: boolean
  amount?: number
  trial_end?: string
}

export interface PlanFeatures {
  name: string
  price_monthly: number
  price_annual: number
  max_members: number | null
  features: string[]
}

export const PLANS: Record<string, PlanFeatures> = {
  starter: {
    name: 'Starter',
    price_monthly: 19,
    price_annual: 15,
    max_members: 30,
    features: [
      'Up to 30 members',
      'Public lodge website',
      'Member portal',
      'Dues tracking',
      'Event calendar',
      'Basic email reminders',
      'Petition form',
      'LodgeOS subdomain',
    ]
  },
  pro: {
    name: 'Pro',
    price_monthly: 39,
    price_annual: 32,
    max_members: null,
    features: [
      'Unlimited members',
      'Everything in Starter',
      'Online dues payments',
      'Custom domain',
      'Document library',
      'Full email automation',
      'Attendance tracking',
      'Degree progress tracker',
      'Export reports',
      'Priority support',
    ]
  },
  district: {
    name: 'District',
    price_monthly: 79,
    price_annual: 65,
    max_members: null,
    features: [
      'Everything in Pro',
      'Up to 10 lodges',
      'District reporting dashboard',
      'Cross-lodge communications',
      'White label option',
      'Custom email domain',
      'Dedicated support',
      'Custom onboarding',
    ]
  }
}
