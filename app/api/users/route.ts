import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function GET() {
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
        { success: false, message: "Only administrators can view users" },
        { status: 403 }
      );
    }

    const [users, organization] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: currentUser.organizationId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.organization.findUnique({
        where: { id: currentUser.organizationId },
        select: { userLimit: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      users,
      userLimit: organization?.userLimit ?? 0,
      currentUserCount: users.length,
    });
  } catch (error) {
    console.error("List users error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
        { success: false, message: "Only administrators can create users" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const role = body.role === "ADMIN" ? "ADMIN" : "USER";

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, message: "Name, email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Server-side user-limit enforcement — this must never depend on the
    // frontend (SRS Section 9 / 27). Counting inside the same request
    // avoids trusting any client-supplied count.
    const [organization, currentUserCount] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: currentUser.organizationId },
        select: { userLimit: true },
      }),
      prisma.user.count({
        where: { organizationId: currentUser.organizationId },
      }),
    ]);

    if (!organization) {
      return NextResponse.json(
        { success: false, message: "Organization not found" },
        { status: 404 }
      );
    }

    if (currentUserCount >= organization.userLimit) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User limit reached. Increase the organization user limit or deactivate an existing user.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        organizationId: currentUser.organizationId,
        name,
        email,
        passwordHash,
        role,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
      { status: 201 }
    );
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

    console.error("Create user error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create user" },
      { status: 500 }
    );
  }
}