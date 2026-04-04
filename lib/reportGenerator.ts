/**
 * Report Generator
 * Converts agent outputs into downloadable PDF and DOCX files
 */

// ── Markdown to styled HTML ──
function markdownToHTML(md: string): string {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;margin:18px 0 8px;color:#111;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:24px 0 10px;color:#111;border-bottom:1px solid #e5e7eb;padding-bottom:6px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:700;margin:28px 0 12px;color:#111;">$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:12px;">$1</code>')
    // Bullet lists
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;font-size:13px;">$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0;font-size:13px;">$1</li>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">')
    // Paragraphs (lines that aren't already HTML)
    .replace(/^(?!<[hluocd]|<li|<hr|<strong|<em|<table|<tr|<td|<th)(.+)$/gm, '<p style="margin:6px 0;font-size:13px;line-height:1.6;color:#374151;">$1</p>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/g, '<ul style="margin:8px 0;padding-left:20px;">$1</ul>');

  // Simple table support
  html = html.replace(/\|(.+)\|/g, (match) => {
    const cells = match.split('|').filter(c => c.trim()).map(c => c.trim());
    if (cells.every(c => c.match(/^[-:]+$/))) return ''; // separator row
    const isHeader = cells.some(c => c.match(/^[-:]+$/));
    const tag = isHeader ? 'th' : 'td';
    const style = tag === 'th'
      ? 'style="padding:6px 12px;text-align:left;font-size:11px;font-weight:600;background:#f9fafb;border:1px solid #e5e7eb;"'
      : 'style="padding:6px 12px;font-size:12px;border:1px solid #e5e7eb;"';
    return `<tr>${cells.map(c => `<${tag} ${style}>${c}</${tag}>`).join('')}</tr>`;
  });

  // Wrap consecutive <tr> in <table>
  html = html.replace(/((?:<tr>.*?<\/tr>\s*)+)/g,
    '<table style="width:100%;border-collapse:collapse;margin:12px 0;">$1</table>');

  return html;
}

// ── Brand header HTML ──
function brandHeader(title: string, subtitle?: string): string {
  return `
    <div style="background:#000;padding:32px 40px;margin:-40px -40px 30px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <div style="width:36px;height:36px;background:#2CACE8;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-weight:800;font-size:18px;">M</span>
        </div>
        <div>
          <span style="color:#fff;font-size:16px;font-weight:600;">marketing</span>
          <span style="color:#2CACE8;font-size:16px;font-weight:600;">powered</span>
        </div>
      </div>
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:16px 0 4px;">${title}</h1>
      ${subtitle ? `<p style="color:#9ca3af;font-size:13px;margin:0;">${subtitle}</p>` : ""}
      <p style="color:#6b7280;font-size:11px;margin-top:8px;">Generated ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at ${new Date().toLocaleTimeString()}</p>
    </div>`;
}

// ── Generate full HTML report ──
export function generateHTMLReport(params: {
  title: string;
  subtitle?: string;
  sections: { agentName: string; agentId: number; content: string }[];
  pipelineName?: string;
}): string {
  const sectionHTML = params.sections.map((s, i) => `
    <div style="margin-bottom:32px;page-break-inside:avoid;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="width:28px;height:28px;background:#2CACE8;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">${String(s.agentId).padStart(2, "0")}</div>
        <h2 style="font-size:15px;font-weight:700;color:#111;margin:0;">Step ${i + 1}: ${s.agentName}</h2>
      </div>
      <div style="padding-left:38px;">
        ${markdownToHTML(s.content)}
      </div>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${params.title} - Marketing Powered</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', -apple-system, sans-serif; color: #111; padding: 40px; max-width: 900px; margin: 0 auto; background: #fff; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  ${brandHeader(params.title, params.subtitle || params.pipelineName)}
  ${sectionHTML}
  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;">
    <p style="font-size:10px;color:#9ca3af;">Marketing Powered AI Operating System &middot; 33 Agents &middot; 9 Divisions &middot; Report generated automatically</p>
  </div>
</body>
</html>`;
}

// ── Download as HTML (printable) ──
export function downloadHTMLReport(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Download as DOCX ──
// Uses HTML-to-DOCX conversion via mhtml format (opens in Word)
export function downloadDOCXReport(html: string, filename: string) {
  const docContent = `
MIME-Version: 1.0
Content-Type: multipart/related; boundary="----=_NextPart"

------=_NextPart
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: quoted-printable

<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: letter; margin: 1in; }
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #333; }
    h1 { font-size: 18pt; color: #111; }
    h2 { font-size: 14pt; color: #111; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    h3 { font-size: 12pt; color: #333; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #ccc; padding: 4pt 8pt; font-size: 10pt; }
    th { background: #f5f5f5; font-weight: bold; }
    ul { margin: 6pt 0; padding-left: 18pt; }
    li { margin: 2pt 0; }
    p { margin: 4pt 0; line-height: 1.5; }
  </style>
</head>
<body>
${html
  .replace(/<style>[\s\S]*?<\/style>/g, '') // Remove embedded styles
  .replace(/style="[^"]*"/g, '') // Remove inline styles for cleaner Word output
}
</body>
</html>

------=_NextPart--`;

  const blob = new Blob([docContent], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Download as Markdown ──
export function downloadMarkdownReport(sections: { agentName: string; agentId: number; content: string }[], filename: string, title: string) {
  let md = `# ${title}\n\n`;
  md += `*Generated by Marketing Powered AI Operating System*\n`;
  md += `*${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}*\n\n---\n\n`;

  sections.forEach((s, i) => {
    md += `## Step ${i + 1}: Agent ${String(s.agentId).padStart(2, "0")} - ${s.agentName}\n\n`;
    md += s.content;
    md += "\n\n---\n\n";
  });

  md += `\n*33 Specialized AI Agents · 9 Operational Divisions · Full-Stack Agency Automation*\n`;

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Print report ──
export function printReport(html: string) {
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }
}
