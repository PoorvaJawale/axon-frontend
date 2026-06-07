import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  try {
    const data = await req.json();
    // In a real application, you would mail this or insert it to a database
    console.log("Contact Sales Form Submitted:", data);
    return NextResponse.json({
      success: true,
      message: "Thanks! We will reach out within 24 hours.",
    });
  } catch (err) {
    return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
  }
}
