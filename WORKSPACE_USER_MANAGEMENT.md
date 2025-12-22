# Workspace User Management Documentation

## Database Structure

### User Storage by Workspace
Each workspace maintains its own separate user list. Users are stored in the following structure:

```
workspaces/
  {workspaceId}/
    users/
      {userId}/
        role: "owner" | "admin" | "manager" | "staff" | "operator"
        permissions: string[]  // Array of permission strings
        createdAt: Timestamp
        updatedAt: Timestamp
        createdBy: string
```

**Important:** Each workspace's users are stored separately. A user can be a member of multiple workspaces, each with potentially different roles and permissions.

### Global User Profiles
User profile information is stored globally:

```
users/
  {userId}/
    email: string
    displayName: string | null
    createdAt: Timestamp
    updatedAt: Timestamp
    isSuperAdmin?: boolean
```

## User Login Process

When a user logs in, the system performs the following checks:

### 1. User Profile Check
- Checks if user profile exists in `users/{userId}`
- Creates profile if it doesn't exist
- Logs: `✓ User profile found` or `⚠ New user detected, creating user profile...`

### 2. Workspace Membership Check
- Fetches all workspaces from `workspaces` collection
- For each workspace, checks if user exists in `workspaces/{workspaceId}/users/{userId}`
- Logs detailed information for each workspace the user belongs to:
  ```
  ✓ User is member of workspace: {name}
    - Workspace ID: {workspaceId}
    - Role: {role}
    - Permissions: {permissions}
    - Database Path: workspaces/{workspaceId}/users/{userId}
  ```

### 3. Validation
- If user has no workspaces: Shows warning in console
- If user has workspaces: Selects first workspace as default
- Logs session data including:
  - User ID
  - Email
  - Display Name
  - Selected Workspace ID
  - Role in selected workspace
  - Total workspace count
  - Super admin status

## Console Logging

### Login Process Logs
All login operations are logged to the browser console with detailed information:

```
=== User Login Process Started ===
User ID: {userId}
User Email: {email}
✓ User profile found
Super Admin Status: {true/false}
Fetching user workspaces...
✓ Found {count} workspace(s) for user
User Workspaces Details:
  1. Workspace: {name} (ID: {workspaceId})
     Role: {role}
     Path: workspaces/{workspaceId}/users/{userId}
Default Workspace Selected: {details}
Session Data: {full session object}
✓ Session updated successfully
=== User Login Process Completed ===
```

### Warnings
- If user has no workspaces: `⚠ WARNING: User has no workspaces assigned!`
- If no default workspace: `⚠ No default workspace selected - user has no workspaces`

## Adding Users to Workspaces

When adding a user to a workspace via the Admin panel:

1. **User Creation**: Creates Firebase Auth user
2. **Profile Creation**: Creates user profile in `users/{userId}`
3. **Workspace Assignment**: Adds user to `workspaces/{workspaceId}/users/{userId}`
4. **Role Assignment**: Sets role and fetches permissions for that role
5. **Permission Storage**: Saves permissions array to user document

### Logs When Adding User
```
[addUserToWorkspace] Adding user to workspace...
  - Workspace ID: {workspaceId}
  - User ID: {userId}
  - Role: {role}
  - Created By: {createdBy}
  - Database Path: workspaces/{workspaceId}/users/{userId}
  - Permissions: {permissions}
[addUserToWorkspace] Saving user data to Firestore...
[addUserToWorkspace] ✓ User successfully added to workspace
```

## Updating User Roles

When updating a user's role:

1. Fetches new role permissions from `workspaces/{workspaceId}/role-permissions/{role}`
2. Updates user document in `workspaces/{workspaceId}/users/{userId}`
3. Updates both `role` and `permissions` fields

### Logs When Updating Role
```
[updateUserRole] Updating user role...
  - Workspace ID: {workspaceId}
  - User ID: {userId}
  - New Role: {role}
  - Database Path: workspaces/{workspaceId}/users/{userId}
  - New Permissions: {permissions}
[updateUserRole] ✓ User role updated successfully
```

## Verification Checklist

To verify a user is properly set up:

1. **Check Browser Console** (F12) during login:
   - Should see "User Login Process Started"
   - Should see workspace details for each workspace
   - Should see "Session updated successfully"

2. **Check Firebase Console**:
   - Navigate to `workspaces/{workspaceId}/users/{userId}`
   - Verify document exists
   - Verify `role` field is set
   - Verify `permissions` array is populated

3. **Check User Profile**:
   - Navigate to `users/{userId}`
   - Verify email and displayName are set

## Troubleshooting

### User has no workspaces
**Symptom:** Console shows "⚠ WARNING: User has no workspaces assigned!"

**Solution:**
1. Go to Admin panel
2. Select a workspace
3. Click "Add User"
4. Enter user email and select role
5. User will be added to the workspace

### User role not showing
**Symptom:** User can log in but has no role

**Solution:**
1. Check `workspaces/{workspaceId}/users/{userId}` exists
2. Verify `role` field is set
3. If missing, update role via Admin panel

### Permissions not working
**Symptom:** User has role but permissions don't work

**Solution:**
1. Check `workspaces/{workspaceId}/users/{userId}/permissions` array
2. Verify permissions match role permissions in `workspaces/{workspaceId}/role-permissions/{role}`
3. If mismatch, update user role via Admin panel to refresh permissions

## Key Points

1. **Separation**: Each workspace maintains its own user list - users are NOT stored in a single location
2. **Multiple Memberships**: A user can belong to multiple workspaces with different roles
3. **Permission Inheritance**: Permissions are fetched from role-permissions collection and stored with user
4. **Automatic Updates**: When role changes, permissions are automatically updated
5. **Detailed Logging**: All operations are logged to console for debugging

