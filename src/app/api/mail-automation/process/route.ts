import { downloadFileContent, isReadableFile } from "@/lib/googleDrive";
import { analyzeDocument, type MailAnalysis } from "@/lib/gemini";
import { asanaFetch, type AsanaTask } from "@/lib/asana";
import { listFolderFiles } from "@/lib/googleDrive";

/* ---------- Urgency → Asana due date offset ---------- */

function urgencyToDueDays(urgency: string): number {
  switch (urgency) {
    case "Critical":
      return 1;
    case "High":
      return 3;
    case "Medium":
      return 7;
    case "Low":
      return 14;
    default:
      return 7;
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/* ---------- Category → Asana section/tag color ---------- */

const CATEGORY_COLORS: Record<string, string> = {
  "Invoice / Bill": "dark-red",
  "Legal / Contract": "dark-purple",
  "Government / Tax": "dark-blue",
  Insurance: "dark-teal",
  "Medical / Health": "dark-green",
  "Banking / Financial": "dark-orange",
  "Subscription / Service": "light-blue",
  "Personal Correspondence": "light-green",
  "Marketing / Promotional": "light-purple",
  Other: "light-warm-gray",
};

/* ---------- Build Asana task description ---------- */

function buildTaskNotes(analysis: MailAnalysis, fileName: string, fileLink?: string): string {
  const lines: string[] = [];
  lines.push(`📬 Mail Automation — Processed from scanned document`);
  lines.push("");
  lines.push(`📄 File: ${fileName}`);
  if (fileLink) lines.push(`🔗 View in Drive: ${fileLink}`);
  lines.push("");
  lines.push(`── Summary ──`);
  lines.push(analysis.summary);
  lines.push("");
  lines.push(`── Details ──`);
  lines.push(`Sender: ${analysis.sender}`);
  lines.push(`Date on Document: ${analysis.dateReceived}`);
  lines.push(`Category: ${analysis.category}`);
  lines.push(`Urgency: ${analysis.urgency}`);
  lines.push("");
  lines.push(`── Action Required ──`);
  lines.push(analysis.actionRequired);
  lines.push("");
  lines.push(`── Key Details ──`);
  analysis.keyDetails.forEach((d) => lines.push(`• ${d}`));
  return lines.join("\n");
}

/* ---------- POST handler ---------- */

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      driveAccessToken: string;
      folderId: string;
      geminiApiKey: string;
      asanaPat: string;
      asanaProjectGid: string;
      processedFileIds: string[];
    };

    const {
      driveAccessToken,
      folderId,
      geminiApiKey,
      asanaPat,
      asanaProjectGid,
      processedFileIds = [],
    } = body;

    if (!driveAccessToken || !folderId || !geminiApiKey || !asanaPat || !asanaProjectGid) {
      return Response.json(
        { error: "All credentials and configuration are required" },
        { status: 400 }
      );
    }

    // 1. List files in the watched folder
    const files = await listFolderFiles(driveAccessToken, folderId);

    // 2. Filter to new, readable files
    const newFiles = files.filter(
      (f) => !processedFileIds.includes(f.id) && isReadableFile(f.mimeType)
    );

    if (newFiles.length === 0) {
      return Response.json({
        processed: 0,
        tasks: [],
        newProcessedIds: [],
        message: "No new files to process",
      });
    }

    const results: Array<{
      fileId: string;
      fileName: string;
      analysis: MailAnalysis;
      task: AsanaTask;
    }> = [];
    const errors: Array<{ fileId: string; fileName: string; error: string }> = [];

    // 3. Process each new file
    for (const file of newFiles.slice(0, 10)) {
      // limit to 10 per batch
      try {
        // Download content
        const { content, exportedMime } = await downloadFileContent(
          driveAccessToken,
          file.id,
          file.mimeType
        );

        // Analyze with Gemini
        const analysis = await analyzeDocument(
          geminiApiKey,
          content,
          exportedMime,
          file.name
        );

        // Create Asana task
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + urgencyToDueDays(analysis.urgency));

        const urgencyPrefix =
          analysis.urgency === "Critical"
            ? "🔴 "
            : analysis.urgency === "High"
              ? "🟠 "
              : analysis.urgency === "Medium"
                ? "🟡 "
                : "🟢 ";

        const taskData: Record<string, unknown> = {
          name: `${urgencyPrefix}[${analysis.category}] ${analysis.title}`,
          notes: buildTaskNotes(analysis, file.name, file.webViewLink),
          projects: [asanaProjectGid],
          due_on: formatDate(dueDate),
        };

        const asanaRes = await asanaFetch<AsanaTask>(asanaPat, "/tasks", {
          method: "POST",
          body: JSON.stringify({ data: taskData }),
        });

        // Try to add a tag based on category color (non-critical if fails)
        try {
          const color = CATEGORY_COLORS[analysis.category] || "light-warm-gray";
          // Try to find or create tag
          const tagsRes = await asanaFetch<Array<{ gid: string; name: string }>>(
            asanaPat,
            `/workspaces/${(await getWorkspaceFromProject(asanaPat, asanaProjectGid))}/tags?opt_fields=name&limit=100`
          );
          const existingTag = (tagsRes.data || []).find(
            (t: { name: string }) => t.name === analysis.category
          );

          let tagGid = existingTag?.gid;
          if (!tagGid) {
            const wsGid = await getWorkspaceFromProject(asanaPat, asanaProjectGid);
            const newTag = await asanaFetch<{ gid: string }>(asanaPat, "/tags", {
              method: "POST",
              body: JSON.stringify({
                data: {
                  name: analysis.category,
                  color,
                  workspace: wsGid,
                },
              }),
            });
            tagGid = newTag.data.gid;
          }

          await asanaFetch(asanaPat, `/tasks/${asanaRes.data.gid}/addTag`, {
            method: "POST",
            body: JSON.stringify({ data: { tag: tagGid } }),
          });
        } catch {
          // Tag creation is non-critical
        }

        results.push({
          fileId: file.id,
          fileName: file.name,
          analysis,
          task: asanaRes.data,
        });
      } catch (err) {
        errors.push({
          fileId: file.id,
          fileName: file.name,
          error: err instanceof Error ? err.message : "Processing failed",
        });
      }
    }

    return Response.json({
      processed: results.length,
      tasks: results,
      errors,
      newProcessedIds: results.map((r) => r.fileId),
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Automation processing failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

/* ---------- Helper: get workspace from project ---------- */

async function getWorkspaceFromProject(
  pat: string,
  projectGid: string
): Promise<string> {
  const res = await asanaFetch<{ workspace: { gid: string } }>(
    pat,
    `/projects/${projectGid}?opt_fields=workspace`
  );
  return res.data.workspace.gid;
}
