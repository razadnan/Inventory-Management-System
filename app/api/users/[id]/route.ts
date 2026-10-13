import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Only administrators can view user details" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const user = await prisma.user.findFirst({
      where: { id, organizationId: currentUser.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Only administrators can edit users" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.user.findFirst({
      where: { id, organizationId: currentUser.organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Prevent an admin from locking themselves out or demoting themselves
    // into a state with no admins left in the organization.
    if (existing.id === currentUser.userId) {
      if (body.status === "INACTIVE") {
        return NextResponse.json(
          { success: false, message: "You cannot deactivate your own account" },
          { status: 400 }
        );
      }
      if (body.role === "USER") {
        return NextResponse.json(
          { success: false, message: "You cannot remove your own admin role" },
          { status: 400 }
        );
      }
    }

    const data: {
      name?: string;
      email?: string;
      role?: "ADMIN" | "USER";
      status?: string;
      passwordHash?: string;
    } = {};

    if (body.name?.trim()) data.name = body.name.trim();
    if (body.email?.trim()) data.email = body.email.trim().toLowerCase();
    if (body.role === "ADMIN" || body.role === "USER") data.role = body.role;
    if (body.status === "ACTIVE" || body.status === "INACTIVE") data.status = body.status;

    if (body.newPassword) {
      if (body.newPassword.length < 6) {
        return NextResponse.json(
          { success: false, message: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }
      data.passwordHash = await bcrypt.hash(body.newPassword, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    return NextResponse.json({ success: true, message: "User updated", user });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, message: "A user with this email already exists in your organization" },
        { status: 409 }
      );
    }

    console.error("Update user error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Only administrators can deactivate users" },
        { status: 403 }
      );
    }

    const { id } = await params;

    if (id === currentUser.userId) {
      return NextResponse.json(
        { success: false, message: "You cannot deactivate your own account" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findFirst({
      where: { id, organizationId: currentUser.organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Soft delete: StockMovement/Challan records reference userId for
    // audit history (SRS Section 38), so we deactivate rather than
    // hard-delete to preserve traceability and avoid FK constraint errors.
    await prisma.user.update({
      where: { id },
      data: { status: "INACTIVE" },
    });

    return NextResponse.json({ success: true, message: "User deactivated" });
  } catch (error) {
    console.error("Deactivate user error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to deactivate user" },
      { status: 500 }
    );
  }
}