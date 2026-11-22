import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export async function exportReportToPdf(filename: string): Promise<void> {
  const root = document.getElementById('pdf-report-root');
  if (!root) {
    throw new Error('PDF report container not found.');
  }

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Allow layout to settle after mount
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

  const blocks = Array.from(root.querySelectorAll<HTMLElement>('.pdf-block'));
  if (blocks.length === 0) {
    throw new Error('No PDF report blocks found.');
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();
  const topBottomMarginMm = 6;
  const usableHeightMm = pageHeightMm - topBottomMarginMm * 2;

  let currentY = topBottomMarginMm;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const canvas = await html2canvas(block, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.94);
    const imgWidthMm = pageWidthMm;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

    // Start a new page if block does not fit on the remaining page space
    if (i > 0 && currentY + imgHeightMm > pageHeightMm - topBottomMarginMm) {
      pdf.addPage();
      currentY = topBottomMarginMm;
    }

    // If a single block is taller than a full page, scale it down proportionally to fit
    if (imgHeightMm > usableHeightMm) {
      const ratio = usableHeightMm / imgHeightMm;
      const fittedWidth = imgWidthMm * ratio;
      const xOffset = (pageWidthMm - fittedWidth) / 2;
      pdf.addImage(imgData, 'JPEG', xOffset, currentY, fittedWidth, usableHeightMm);
      currentY += usableHeightMm;
    } else {
      pdf.addImage(imgData, 'JPEG', 0, currentY, imgWidthMm, imgHeightMm);
      currentY += imgHeightMm;
    }
  }

  pdf.save(filename);
}
