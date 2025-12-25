import { db } from '../lib/firebase'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type Timestamp,
  type DocumentData,
} from 'firebase/firestore'
import { addUserToWorkspace, type Role } from './workspace-users'

export interface WorkspaceInvitation {
  id: string
  email: string
  role: Role
  token: string
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  createdBy: string
  createdAt: Date | Timestamp
  expiresAt: Date | Timestamp
  acceptedAt?: Date | Timestamp
  acceptedBy?: string
  existingUserId?: string | null
}

export interface InviteUserInput {
  email: string
  role: Role
}

/**
 * Send workspace invitation
 */
export async function inviteUserToWorkspace(
  workspaceId: string,
  input: InviteUserInput
): Promise<{ invitationId: string; token: string }> {
  if (!workspaceId || !input.email || !input.role) {
    throw new Error('workspaceId, email, and role are required')
  }

  // Get workspace and inviter info
  const workspaceDoc = await getDoc(doc(db, 'workspaces', workspaceId))
  if (!workspaceDoc.exists()) {
    throw new Error('Workspace not found')
  }

  const workspaceData = workspaceDoc.data()
  const workspaceName = workspaceData.name || 'Workspace'

  // Get current user info
  const { useSessionStore } = await import('../state/sessionStore')
  const session = useSessionStore.getState()
  const inviterName = session.displayName || session.email || 'Workspace Owner'

  // Call Firebase Function
  const sendInvitation = httpsCallable(functions, 'sendWorkspaceInvitation')
  const result = await sendInvitation({
    workspaceId,
    email: input.email.toLowerCase(),
    role: input.role,
    inviterName,
    workspaceName,
  })

  const data = result.data as { success: boolean; invitationId: string; token: string }
  if (!data.success) {
    throw new Error('Failed to send invitation')
  }

  return {
    invitationId: data.invitationId,
    token: data.token,
  }
}

/**
 * List workspace invitations
 */
export async function listWorkspaceInvitations(
  workspaceId: string
): Promise<WorkspaceInvitation[]> {
  if (!workspaceId) {
    throw new Error('workspaceId is required')
  }

  try {
    const invitationsCol = collection(db, 'workspaces', workspaceId, 'invitations')
    const q = query(invitationsCol, orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as DocumentData),
    })) as WorkspaceInvitation[]
  } catch (error) {
    console.error('Error listing workspace invitations:', error)
    throw error
  }
}

/**
 * Accept workspace invitation
 */
export async function acceptWorkspaceInvitation(
  token: string,
  workspaceId: string
): Promise<void> {
  if (!token || !workspaceId) {
    throw new Error('token and workspaceId are required')
  }

  // Get current user
  const { useSessionStore } = await import('../state/sessionStore')
  const session = useSessionStore.getState()
  const userId = session.userId

  if (!userId) {
    throw new Error('User must be logged in to accept invitation')
  }

  // Call Firebase Function
  const acceptInvitation = httpsCallable(functions, 'acceptWorkspaceInvitation')
  const result = await acceptInvitation({
    token,
    workspaceId,
    userId,
  })

  const data = result.data as { success: boolean }
  if (!data.success) {
    throw new Error('Failed to accept invitation')
  }
}

/**
 * Cancel/Delete invitation
 */
export async function cancelInvitation(
  workspaceId: string,
  invitationId: string
): Promise<void> {
  if (!workspaceId || !invitationId) {
    throw new Error('workspaceId and invitationId are required')
  }

  try {
    const invitationRef = doc(db, 'workspaces', workspaceId, 'invitations', invitationId)
    const invitationDoc = await getDoc(invitationRef)

    if (!invitationDoc.exists()) {
      throw new Error('Invitation not found')
    }

    const invitation = invitationDoc.data()
    if (invitation.status !== 'pending') {
      throw new Error('Can only cancel pending invitations')
    }

    await updateDoc(invitationRef, {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error cancelling invitation:', error)
    throw error
  }
}

/**
 * Resend invitation email
 */
export async function resendInvitationEmail(
  workspaceId: string,
  invitationId: string
): Promise<void> {
  if (!workspaceId || !invitationId) {
    throw new Error('workspaceId and invitationId are required')
  }

  const invitationRef = doc(db, 'workspaces', workspaceId, 'invitations', invitationId)
  const invitationDoc = await getDoc(invitationRef)

  if (!invitationDoc.exists()) {
    throw new Error('Invitation not found')
  }

  const invitation = invitationDoc.data() as WorkspaceInvitation

  if (invitation.status !== 'pending') {
    throw new Error('Can only resend pending invitations')
  }

  // Get workspace and inviter info
  const workspaceDoc = await getDoc(doc(db, 'workspaces', workspaceId))
  if (!workspaceDoc.exists()) {
    throw new Error('Workspace not found')
  }

  const workspaceData = workspaceDoc.data()
  const workspaceName = workspaceData.name || 'Workspace'

  // Get inviter info
  const inviterDoc = await getDoc(doc(db, 'users', invitation.createdBy))
  const inviterName =
    inviterDoc.exists() && inviterDoc.data()?.displayName
      ? inviterDoc.data()?.displayName
      : invitation.createdBy

  // Call Firebase Function to resend
  const sendInvitation = httpsCallable(functions, 'sendWorkspaceInvitation')
  await sendInvitation({
    workspaceId,
    email: invitation.email,
    role: invitation.role,
    inviterName,
    workspaceName,
  })
}
