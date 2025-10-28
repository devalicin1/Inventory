export async function listMyTasks(_workspaceId: string, userId: string) {
  // Mock data for demo - in real app, fetch from Firestore
  return [
    {
      id: '1',
      title: 'Cut materials for Widget A',
      description: 'Cut 100 pieces of material according to specifications',
      workflowId: 'production',
      stageId: 'open',
      assigneeId: userId,
      assigneeName: 'John Doe',
      priority: 'high' as const,
      dueDate: '2024-01-15',
      status: 'Open' as const,
      links: { productId: 'prod-1', poId: 'po-1' }
    },
    {
      id: '2',
      title: 'Assemble Widget B components',
      description: 'Assemble 50 units of Widget B',
      workflowId: 'production',
      stageId: 'progress',
      assigneeId: userId,
      assigneeName: 'John Doe',
      priority: 'med' as const,
      dueDate: '2024-01-20',
      status: 'InProgress' as const,
      links: { productId: 'prod-2', poId: 'po-2' }
    },
    {
      id: '3',
      title: 'Quality check Widget A',
      description: 'Perform quality inspection on completed Widget A units',
      workflowId: 'production',
      stageId: 'blocked',
      assigneeId: userId,
      assigneeName: 'John Doe',
      priority: 'urgent' as const,
      dueDate: '2024-01-10',
      status: 'Blocked' as const,
      links: { productId: 'prod-1', poId: 'po-1' }
    },
    {
      id: '4',
      title: 'Package completed items',
      description: 'Package and label completed Widget B units',
      workflowId: 'production',
      stageId: 'done',
      assigneeId: userId,
      assigneeName: 'John Doe',
      priority: 'low' as const,
      dueDate: '2024-01-05',
      status: 'Done' as const,
      links: { productId: 'prod-2', poId: 'po-2' }
    }
  ]
}

