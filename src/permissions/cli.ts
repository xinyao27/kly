import { confirm, log, select, table } from "../ui";
import { clearAllPermissions, listPermissions, revokePermission } from ".";

/**
 * Permissions management CLI
 */
export async function permissionsCommand(): Promise<void> {
  const action = await select({
    prompt: "Permissions Management",
    options: [
      {
        name: "List permissions",
        value: "list",
        description: "View all granted permissions",
      },
      {
        name: "Revoke permission",
        value: "revoke",
        description: "Remove permission for a specific app",
      },
      {
        name: "Clear all",
        value: "clear",
        description: "Remove all permissions",
      },
    ],
  });

  switch (action) {
    case "list":
      await listPermissionsAction();
      break;
    case "revoke":
      await revokePermissionAction();
      break;
    case "clear":
      await clearAllPermissionsAction();
      break;
  }
}

/**
 * List all permissions
 */
async function listPermissionsAction(): Promise<void> {
  const permissions = listPermissions();

  if (permissions.length === 0) {
    log.info("No permissions granted yet.");
    return;
  }

  log.info("📋 Granted Permissions:");

  table({
    columns: [
      { key: "app", header: "App" },
      { key: "grantedAt", header: "Granted At" },
    ],
    rows: permissions.map((p) => ({
      app: p.appName,
      grantedAt: new Date(p.timestamp).toLocaleString(),
    })),
  });
}

/**
 * Revoke permission for a specific app
 */
async function revokePermissionAction(): Promise<void> {
  const permissions = listPermissions();

  if (permissions.length === 0) {
    log.info("No permissions to revoke.");
    return;
  }

  const appId = await select({
    prompt: "Select app to revoke permission:",
    options: permissions.map((p) => ({
      name: p.appName,
      value: p.appId,
      description: "Always allowed",
    })),
  });

  const confirmed = await confirm("Are you sure you want to revoke this permission?");

  if (confirmed) {
    revokePermission(appId);
    log.success("Permission revoked.");
  } else {
    log.warn("Cancelled.");
  }
}

/**
 * Clear all permissions
 */
async function clearAllPermissionsAction(): Promise<void> {
  const confirmed = await confirm("Are you sure you want to clear ALL permissions?");

  if (confirmed) {
    clearAllPermissions();
    log.success("All permissions cleared.");
  } else {
    log.warn("Cancelled.");
  }
}
