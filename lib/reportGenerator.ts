/**
 * Report Generator
 * Converts agent outputs into downloadable Word, HTML, Markdown files
 */

// ── Markdown to clean HTML body content (no wrapper) ──
function markdownToHTML(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^(?!<[hluocd]|<li|<hr|<strong|<em|<table|<tr|<td|<th|\s*$)(.+)$/gm, '<p>$1</p>');

  html = html.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');

  // Simple table support
  const lines = html.split('\n');
  const processed: string[] = [];
  let inTable = false;

  for (const line of lines) {
    if (line.includes('|') && line.trim().startsWith('|')) {
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) continue; // skip separator
      if (!inTable) {
        processed.push('<table>');
        inTable = true;
      }
      processed.push('<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>');
    } else {
      if (inTable) {
        processed.push('</table>');
        inTable = false;
      }
      processed.push(line);
    }
  }
  if (inTable) processed.push('</table>');

  return processed.join('\n');
}

// ── Build report body HTML (no DOCTYPE, no <html> wrapper) ──
function buildReportBody(params: {
  title: string;
  subtitle?: string;
  sections: { agentName: string; agentId: number; content: string }[];
}): string {
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const time = new Date().toLocaleTimeString();

  let body = `
<div class="header">
  <div class="brand">
    <div class="brand-icon">M</div>
    <div><span class="brand-name">marketing</span><span class="brand-accent">powered</span></div>
  </div>
  <h1 class="title">${params.title}</h1>
  ${params.subtitle ? `<p class="subtitle">${params.subtitle}</p>` : ''}
  <p class="date">Generated ${date} at ${time}</p>
</div>
`;

  params.sections.forEach((s, i) => {
    body += `
<div class="section">
  <div class="section-header">
    <div class="agent-badge">${String(s.agentId).padStart(2, '0')}</div>
    <h2>Step ${i + 1}: ${s.agentName}</h2>
  </div>
  <div class="section-body">
    ${markdownToHTML(s.content)}
  </div>
</div>
`;
  });

  body += `
<div class="footer">
  <p>Marketing Powered AI Operating System &middot; 33 Agents &middot; 9 Divisions &middot; Report generated automatically</p>
</div>`;

  return body;
}

// ── CSS for reports ──
const REPORT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111; padding: 40px; max-width: 900px; margin: 0 auto; background: #fff; font-size: 13px; line-height: 1.6; }
  .header { background: #000; color: #fff; padding: 32px; margin: -40px -40px 30px; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .brand-icon { width: 32px; height: 32px; background: #2CACE8; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 16px; text-align: center; line-height: 32px; }
  .brand-name { color: #fff; font-size: 16px; font-weight: 600; }
  .brand-accent { color: #2CACE8; font-size: 16px; font-weight: 600; }
  .title { font-size: 22px; font-weight: 700; margin: 8px 0 4px; }
  .subtitle { color: #9ca3af; font-size: 13px; }
  .date { color: #6b7280; font-size: 11px; margin-top: 8px; }
  .section { margin-bottom: 28px; page-break-inside: avoid; }
  .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; border-bottom: 2px solid #2CACE8; padding-bottom: 8px; }
  .section-header h2 { font-size: 15px; font-weight: 700; }
  .agent-badge { width: 28px; height: 28px; background: #2CACE8; border-radius: 6px; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 28px; }
  .section-body { padding-left: 38px; }
  h1 { font-size: 18px; font-weight: 700; margin: 20px 0 8px; }
  h2 { font-size: 15px; font-weight: 700; margin: 16px 0 6px; }
  h3 { font-size: 13px; font-weight: 700; margin: 12px 0 4px; }
  p { margin: 6px 0; }
  ul { margin: 8px 0; padding-left: 20px; }
  li { margin: 3px 0; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  td, th { border: 1px solid #d1d5db; padding: 6px 10px; font-size: 12px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  code { background: #f3f4f6; padding: 2px 5px; border-radius: 3px; font-size: 12px; font-family: monospace; }
  strong { font-weight: 700; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  .footer p { font-size: 10px; color: #9ca3af; }
  @media print { body { padding: 20px; } .header { margin: -20px -20px 20px; padding: 24px; } }
`;

// ── Generate full HTML document ──
export function generateHTMLReport(params: {
  title: string;
  subtitle?: string;
  sections: { agentName: string; agentId: number; content: string }[];
  pipelineName?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${params.title} - Marketing Powered</title>
<style>${REPORT_CSS}</style>
</head>
<body>
${buildReportBody({ title: params.title, subtitle: params.subtitle || params.pipelineName, sections: params.sections })}
</body>
</html>`;
}

// ── Force download helper ──
function forceDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  // Cleanup after a short delay
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

// ── Download as HTML ──
export function downloadHTMLReport(html: string, filename: string) {
  forceDownload(html, `${filename}.html`, "text/html;charset=utf-8");
}

// ── Download as Word (.doc) ──
export function downloadDOCXReport(
  sections: { agentName: string; agentId: number; content: string }[],
  filename: string,
  title: string,
  subtitle?: string
) {
  const body = buildReportBody({ title, subtitle, sections });

  const wordDoc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Marketing Powered AI OS">
<style>
  @page { size: 8.5in 11in; margin: 1in; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #333; line-height: 1.5; }
  .header { background: #000; color: #fff; padding: 24pt; margin-bottom: 18pt; }
  .brand-icon { display: inline-block; width: 24pt; height: 24pt; background: #2CACE8; color: #fff; text-align: center; line-height: 24pt; font-weight: bold; font-size: 14pt; }
  .brand-name { color: #fff; font-size: 14pt; font-weight: bold; }
  .brand-accent { color: #2CACE8; font-size: 14pt; font-weight: bold; }
  .title { font-size: 18pt; font-weight: bold; color: #fff; margin-top: 12pt; }
  .subtitle { color: #999; font-size: 10pt; }
  .date { color: #666; font-size: 9pt; }
  h1 { font-size: 16pt; color: #111; }
  h2 { font-size: 13pt; color: #111; border-bottom: 1pt solid #ccc; padding-bottom: 4pt; }
  h3 { font-size: 11pt; color: #333; }
  .section { margin-bottom: 18pt; }
  .section-header { margin-bottom: 8pt; }
  .section-header h2 { display: inline; }
  .agent-badge { display: inline-block; background: #2CACE8; color: #fff; font-weight: bold; font-size: 9pt; padding: 2pt 6pt; margin-right: 6pt; }
  .section-body { margin-left: 30pt; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1pt solid #ccc; padding: 4pt 8pt; font-size: 10pt; }
  th { background: #f5f5f5; font-weight: bold; }
  ul { margin: 6pt 0; padding-left: 18pt; }
  li { margin: 2pt 0; }
  p { margin: 4pt 0; }
  .footer { margin-top: 24pt; border-top: 1pt solid #ccc; padding-top: 8pt; font-size: 8pt; color: #999; }
</style>
</head>
<body>
${body}
</body>
</html>`;

  forceDownload(wordDoc, `${filename}.doc`, "application/msword");
}

// ── Download as Markdown ──
export function downloadMarkdownReport(
  sections: { agentName: string; agentId: number; content: string }[],
  filename: string,
  title: string
) {
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  let md = `# ${title}\n\n`;
  md += `*Generated by Marketing Powered AI Operating System*\n`;
  md += `*${date}*\n\n---\n\n`;

  sections.forEach((s, i) => {
    md += `## Step ${i + 1}: Agent ${String(s.agentId).padStart(2, '0')} - ${s.agentName}\n\n`;
    md += s.content;
    md += "\n\n---\n\n";
  });

  md += `\n*33 Specialized AI Agents · 9 Operational Divisions · Full-Stack Agency Automation*\n`;

  forceDownload(md, `${filename}.md`, "text/markdown;charset=utf-8");
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
