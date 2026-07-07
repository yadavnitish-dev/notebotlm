import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 });
    }

    const file = await db.file.findFirst({
      where: {
        id: fileId,
        userId: session.user.id,
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const supabase = getSupabase();
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("files")
      .download(file.supabasePath);

    if (downloadError || !fileData) {
      console.error("Failed to download PDF from Supabase:", downloadError);
      return NextResponse.json(
        { error: "Failed to download file" },
        { status: 500 },
      );
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.fileType || "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error serving PDF file:", error);
    return NextResponse.json({ error: "Failed to serve PDF" }, { status: 500 });
  }
}
