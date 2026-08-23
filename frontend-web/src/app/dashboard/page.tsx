'use client'
import { useEffect, useState } from 'react'
import { businessApi, leadsApi } from '@/lib/api'

const statusColors: Record<string, string> = {
  NEW: 'bg-orange-100 text-orange-700',
  VIEWED: 'bg-blue-100 text-blue-700',
  QUOTED: 'bg-purple-100 text-purple-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-700',
  REJECTED: 'bg-red-100 text-red-700',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([businessApi.getDashboard(), leadsApi.getMyLeads()])
      .then(([s, l]) => { setStats(s.data); setLeads(l.data?.slice(0, 5) ?? []) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">Dashboard</div>
          <div className="text-sm opacity-60 mt-0.5">ServiConnect Business</div>
        </div>
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm">B</div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total leads', value: stats?.leadCount ?? 0 },
            { label: 'Profile views', value: stats?.viewCount ?? 0 },
            { label: 'Rating', value: stats?.ratingAvg?.toFixed(1) ?? '—' },
            { label: 'Reviews', value: stats?.reviewCount ?? 0 },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="text-xs text-gray-500 mb-1">{m.label}</div>
              <div className="text-2xl font-bold text-gray-900">{m.value}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-900">Recent leads</span>
            <a href="/dashboard/leads" className="text-sm text-blue-600 font-medium">View all →</a>
          </div>
          {leads.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">No leads yet. Boost your listing to get started.</div>
          ) : leads.map((lead: any) => (
            <div key={lead.id} className="px-5 py-4 flex items-center gap-3 border-b border-gray-50 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">{lead.business?.name ?? 'Customer'}</div>
                <div className="text-xs text-gray-500 truncate mt-0.5">{lead.message}</div>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${statusColors[lead.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {lead.status}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Manage leads', href: '/dashboard/leads', icon: '📥' },
            { label: 'Edit profile', href: '/dashboard/profile', icon: '✏️' },
            { label: 'Boost listing', href: '/dashboard/promote', icon: '🚀' },
            { label: 'Subscription', href: '/dashboard/billing', icon: '💳' },
          ].map(a => (
            <a key={a.label} href={a.href}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 hover:border-blue-500 transition-colors">
              <span className="text-xl">{a.icon}</span>
              <span className="font-medium text-sm text-gray-800">{a.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
