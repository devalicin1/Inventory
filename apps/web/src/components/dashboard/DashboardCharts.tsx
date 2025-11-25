import { useMemo } from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts'
import { Card } from '../ui/Card'

interface DashboardChartsProps {
    jobs: any[]
    isLoading: boolean
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444']

export function DashboardCharts({ jobs, isLoading }: DashboardChartsProps) {
    // Calculate daily production trend (last 7 days)
    const productionTrend = useMemo(() => {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - i)
            d.setHours(0, 0, 0, 0)
            return d
        }).reverse()

        return last7Days.map(date => {
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
            const count = jobs.filter(j => {
                // Check for completedAt or updatedAt if status is done
                if (j.status !== 'done') return false
                const dateToCheck = (j as any).completedAt || (j as any).updatedAt
                if (!dateToCheck) return false

                try {
                    const d = dateToCheck.toDate ? dateToCheck.toDate() : new Date(dateToCheck)
                    d.setHours(0, 0, 0, 0)
                    return d.getTime() === date.getTime()
                } catch {
                    return false
                }
            }).length

            return { name: dayName, jobs: count }
        })
    }, [jobs])

    // Calculate status distribution
    const statusDistribution = useMemo(() => {
        const counts = {
            active: jobs.filter(j => j.status === 'released').length,
            in_progress: jobs.filter(j => j.status === 'in_progress').length,
            done: jobs.filter(j => j.status === 'done').length,
            blocked: jobs.filter(j => j.status === 'blocked').length,
        }

        return [
            { name: 'Active', value: counts.active, color: '#64748b' }, // Slate-500
            { name: 'In Progress', value: counts.in_progress, color: '#3b82f6' }, // Blue-500
            { name: 'Completed', value: counts.done, color: '#10b981' }, // Emerald-500
            { name: 'Blocked', value: counts.blocked, color: '#ef4444' }, // Red-500
        ].filter(item => item.value > 0)
    }, [jobs])

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="h-80 animate-pulse bg-gray-100" />
                <Card className="h-80 animate-pulse bg-gray-100" />
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Production Trend Chart */}
            <Card>
                <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4">Weekly Production Trend</h3>
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={productionTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 12 }}
                                allowDecimals={false}
                            />
                            <Tooltip
                                cursor={{ fill: '#f1f5f9' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar
                                dataKey="jobs"
                                fill="#4f46e5"
                                radius={[4, 4, 0, 0]}
                                barSize={32}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Status Distribution Chart */}
            <Card>
                <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4">Job Status Distribution</h3>
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={statusDistribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {statusDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                formatter={(value, entry: any) => <span className="text-sm text-gray-600 ml-1">{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    )
}
