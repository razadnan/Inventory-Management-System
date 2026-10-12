import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const companyName = body.companyName?.trim();
    const companyAddress = body.companyAddress?.trim() || null;
    const companyEmail = body.companyEmail?.trim().toLowerCase() || null;
    const companyPhone = body.companyPhone?.trim() || null;
    const userLimit = body.userLimit ? Number(body.userLimit) : 10;

    const adminName = body.adminName?.trim();
    const adminEmail = body.adminEmail?.trim().toLowerCase();
    const password = body.password;

    if (!companyName || !adminName || !adminEmail || !password) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Company name, admin name, admin email and password are required",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(userLimit) || userLimit < 1) {
      return NextResponse.json(
        { success: false, message: "User limit must be a positive whole number" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: companyName,
          address: companyAddress,
          email: companyEmail,
          phone: companyPhone,
          userLimit,
        },
      });

      const admin = await tx.user.create({
        data: {
          organizationId: organization.id,
          name: adminName,
          email: adminEmail,
          passwordHash,
          role: "ADMIN",
        },
      });

      return { organization, admin };
    });

    return NextResponse.json({
      success: true,
      message: "Organization and admin account created successfully",
      organization: {
        id: result.organization.id,
        name: result.organization.name,
      },
      user: {
        id: result.admin.id,
        name: result.admin.name,
        email: result.admin.email,
        role: result.admin.role,
      },
    });
  } catch (error) {
    // Handles the case where the same email is used twice within
    // the same organization's uniqueness scope, or other constraint hits.
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, message: "Email already registered" },
        { status: 409 }
      );
    }

    console.error("Register error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}