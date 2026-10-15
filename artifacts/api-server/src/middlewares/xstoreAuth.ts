import { clerkClient, getAuth } from "@clerk/express";
import { and, eq, ilike, sql } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import {
  db,
  xstoreTeamMembers,
  xstoreTenants,
  xstoreUsers,
  type XStoreUser,
} from "@workspace/db";

declare global {
  namespace Express {
    interface Locals {
      xstoreUser?: XStoreUser;
    }
  }
}

async function getOrProvisionUser(clerkUserId: string): Promise<XStoreUser | null> {
  const [existing] = await db
    .select()
    .from(xstoreUsers)
    .where(eq(xstoreUsers.clerkUserId, clerkUserId))
    .limit(1);
  if (existing) return existing;

  const identity = await clerkClient.users.getUser(clerkUserId);
  const emailAddress =
    identity.emailAddresses.find(
      (address) => address.id === identity.primaryEmailAddressId,
    )?.emailAddress ?? identity.emailAddresses[0]?.emailAddress;
  if (!emailAddress) return null;

  const email = emailAddress.trim().toLowerCase();
  const name =
    [identity.firstName, identity.lastName].filter(Boolean).join(" ").trim() ||
    email.split("@")[0] ||
    clerkUserId;

  return db.transaction(async (tx) => {
    // Serialize first-owner bootstrap so two simultaneous sign-ups cannot both
    // claim the single initial platform administrator account.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('xstore-owner-bootstrap'))`);

    const [ownerTenant] = await tx
      .select({ id: xstoreTenants.id })
      .from(xstoreTenants)
      .where(ilike(xstoreTenants.email, email))
      .limit(1);

    const [teamMember] = ownerTenant
      ? []
      : await tx
          .select()
          .from(xstoreTeamMembers)
          .where(ilike(xstoreTeamMembers.email, email))
          .limit(1);

    let role: string;
    let tenantId: string | null = null;
    if (ownerTenant) {
      role = "tenant_admin";
      tenantId = ownerTenant.id;
    } else if (teamMember) {
      role = teamMember.role;
      tenantId = teamMember.tenantId;
    } else {
      const [platformAdmin] = await tx
        .select({ id: xstoreUsers.id })
        .from(xstoreUsers)
        .where(eq(xstoreUsers.role, "platform_admin"))
        .limit(1);
      if (platformAdmin) return null;
      if (process.env.NODE_ENV === "production") {
        const bootstrapEmail = process.env.XSTORE_PLATFORM_ADMIN_EMAIL
          ?.trim()
          .toLowerCase();
        if (!bootstrapEmail || bootstrapEmail !== email) return null;
      }
      role = "platform_admin";
    }

    const [created] = await tx
      .insert(xstoreUsers)
      .values({ clerkUserId, email, name, role, tenantId })
      .onConflictDoNothing({ target: xstoreUsers.clerkUserId })
      .returning();

    if (teamMember) {
      await tx
        .update(xstoreTeamMembers)
        .set({ status: "active" })
        .where(eq(xstoreTeamMembers.id, teamMember.id));
    }

    if (created) return created;
    const [raced] = await tx
      .select()
      .from(xstoreUsers)
      .where(eq(xstoreUsers.clerkUserId, clerkUserId))
      .limit(1);
    return raced ?? null;
  });
}

export async function requireXStoreUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in to continue." });
      return;
    }

    const user = await getOrProvisionUser(userId);
    if (!user) {
      res.status(403).json({
        error: "This account is not assigned to an X-Store workspace.",
      });
      return;
    }

    if (user.tenantId && user.role !== "platform_admin") {
      const [tenant] = await db
        .select({ status: xstoreTenants.status })
        .from(xstoreTenants)
        .where(eq(xstoreTenants.id, user.tenantId))
        .limit(1);
      if (!tenant || tenant.status === "suspended") {
        res.status(403).json({ error: "This store account is suspended." });
        return;
      }
    }

    res.locals.xstoreUser = user;
    next();
  } catch (error) {
    req.log.error({ error }, "Unable to resolve X-Store identity");
    res.status(500).json({ error: "Unable to load the X-Store account." });
  }
}

export function getXStoreUser(res: Response): XStoreUser {
  const user = res.locals.xstoreUser;
  if (!user) throw new Error("X-Store user middleware is missing.");
  return user;
}

export function hasRole(user: XStoreUser, roles: readonly string[]): boolean {
  return roles.includes(user.role);
}

export function denyRole(
  res: Response,
  user: XStoreUser,
  roles: readonly string[],
): boolean {
  if (hasRole(user, roles)) return false;
  res.status(403).json({ error: "You do not have permission for this action." });
  return true;
}

