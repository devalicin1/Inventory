import { useQuery } from '@tanstack/react-query'
import { listJobs, listWorkflows } from '../../../api/production-jobs'
import { listProducts } from '../../../api/inventory'
import { listWorkcenters } from '../../../api/production-jobs'
import { listStockReasons } from '../../../api/settings'

export function useJobQueries(workspaceId: string) {
  const jobsQuery = useQuery({
    queryKey: ['jobs', workspaceId],
    queryFn: () => listJobs(workspaceId),
    enabled: !!workspaceId,
    retry: 2
  })

  const workflowsQuery = useQuery({
    queryKey: ['workflows', workspaceId],
    queryFn: () => listWorkflows(workspaceId),
    enabled: !!workspaceId
  })

  const productsQuery = useQuery({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId),
    enabled: !!workspaceId
  })

  const workcentersQuery = useQuery({
    queryKey: ['workcenters', workspaceId],
    queryFn: () => listWorkcenters(workspaceId),
    enabled: !!workspaceId
  })

  const stockReasonsQuery = useQuery({
    queryKey: ['stockReasons', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      const reasons = await listStockReasons(workspaceId)
      return reasons.filter(r => r.active)
    },
    enabled: !!workspaceId
  })

  return {
    jobs: jobsQuery.data?.jobs || [],
    jobsLoading: jobsQuery.isLoading,
    jobsError: jobsQuery.error,
    workflows: workflowsQuery.data || [],
    products: productsQuery.data || [],
    workcenters: workcentersQuery.data || [],
    stockReasons: stockReasonsQuery.data || [],
  }
}

