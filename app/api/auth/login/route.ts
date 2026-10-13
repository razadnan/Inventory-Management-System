import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password are required",
        },
        { status: 400 }
      );
    }

    // Email is now unique per-organization, not globally, so we look up
    // by email across all orgs. In the MVP a user belongs to exactly one
    // organization (SRS Rule 1), so findFirst is safe here.
    const user = await prisma.user.findFirst({
      where: { email },
      include: { organization: true },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "This account has been deactivated. Contact your administrator.",
        },
        { status: 403 }
      );
    }

    if (user.organization.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "This organization account is inactive.",
        },
        { status: 403 }
      );
    }

    const token = await createSession({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      organization: {
        id: user.organization.id,
        name: user.organization.name,
      },
    });

    response.cookies.set("inventory_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong",
      },
      { status: 500 }
    );
  }
}