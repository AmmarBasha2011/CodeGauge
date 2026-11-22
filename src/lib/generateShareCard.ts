import { resolveCodeHealth } from './health.ts';
import { formatNumber, type Translations } from './i18n.ts';
import { formatBytes } from './languageMap.ts';
import type { AnalysisResult, AppLanguage } from './types.ts';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}...`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}

export async function generateShareCardBlob(
  result: AnalysisResult,
  t: Translations,
  lang: AppLanguage
): Promise<Blob> {
  const width = 1200;
  const height = 630;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  const health = resolveCodeHealth(result);
  const healthColor =
    health.score >= 80
      ? '#10B981'
      : health.score >= 55
        ? '#F59E0B'
        : '#EF4444';

  // Background Canvas (#0B0F17)
  ctx.fillStyle = '#0B0F17';
  ctx.fillRect(0, 0, width, height);

  // Subtle top accent line
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(0, 0, width, 4);

  // Outer frame card (#111827)
  drawRoundedRect(ctx, 44, 40, width - 88, height - 80, 18);
  ctx.fillStyle = '#111827';
  ctx.fill();
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2;
  ctx.stroke();

  const padX = 84;
  const innerWidth = width - padX * 2;

  // Brand row
  ctx.fillStyle = '#38BDF8';
  ctx.font = '700 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(t.brand, padX, 94);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 18px system-ui, -apple-system, sans-serif';
  const reportDate = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(new Date(result.analyzedAt));
  const dateMeasure = ctx.measureText(reportDate).width;
  ctx.fillText(reportDate, width - padX - dateMeasure, 94);

  // Repository Full Name
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 40px ui-monospace, SFMono-Regular, Menlo, monospace';
  const repoTitle = truncateText(
    ctx,
    result.repository.fullName,
    innerWidth - 190
  );
  ctx.fillText(repoTitle, padX, 158);

  // Metadata subtitle line
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 19px system-ui, -apple-system, sans-serif';
  const metaParts = [
    `${t.branchLabel}: ${result.repository.defaultBranch}`,
    `${formatNumber(result.repository.stars, lang)} ${t.starsLabel}`,
    `${formatNumber(result.repository.forks, lang)} ${t.forksLabel}`,
  ];
  if (result.repository.license) {
    metaParts.push(result.repository.license);
  }
  ctx.fillText(
    truncateText(ctx, metaParts.join('  ·  '), innerWidth - 190),
    padX,
    194
  );

  // Health Score box on top right
  const scoreBoxW = 160;
  const scoreBoxH = 92;
  const scoreBoxX = width - padX - scoreBoxW;
  const scoreBoxY = 118;
  drawRoundedRect(ctx, scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH, 12);
  ctx.fillStyle = '#0B0F17';
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  const healthLabelW = ctx.measureText(t.healthGaugeLabel).width;
  ctx.fillText(
    t.healthGaugeLabel,
    scoreBoxX + (scoreBoxW - healthLabelW) / 2,
    scoreBoxY + 28
  );

  ctx.fillStyle = healthColor;
  ctx.font = '700 34px ui-monospace, SFMono-Regular, Menlo, monospace';
  const scoreText = `${health.score}/100`;
  const scoreW = ctx.measureText(scoreText).width;
  ctx.fillText(scoreText, scoreBoxX + (scoreBoxW - scoreW) / 2, scoreBoxY + 70);

  // Divider
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, 232);
  ctx.lineTo(width - padX, 232);
  ctx.stroke();

  // 4-Column KPI Row
  const kpis = [
    {
      label: t.kpiTotalLines,
      value: formatNumber(result.summary.totalLines, lang),
      sub: `${formatNumber(result.summary.codeLines, lang)} code`,
    },
    {
      label: t.kpiLanguages,
      value: formatNumber(result.summary.languageCount, lang),
      sub: result.languages[0]?.name ?? '-',
    },
    {
      label: t.kpiAnalyzedFiles,
      value: formatNumber(result.summary.analyzedFiles, lang),
      sub: formatBytes(result.summary.totalSizeBytes),
    },
    {
      label: t.healthCommentRatioLabel,
      value: health.commentDataAvailable ? `${health.commentRatioPct}%` : '-',
      sub: `${health.healthySizeFilesPct}% ≤ 50 KB`,
    },
  ];

  const colGap = 18;
  const colW = (innerWidth - colGap * 3) / 4;
  const kpiY = 258;
  const kpiH = 122;

  kpis.forEach((kpi, idx) => {
    const x = padX + idx * (colW + colGap);
    drawRoundedRect(ctx, x, kpiY, colW, kpiH, 12);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 15px system-ui, -apple-system, sans-serif';
    ctx.fillText(truncateText(ctx, kpi.label, colW - 32), x + 18, kpiY + 32);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 30px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(truncateText(ctx, kpi.value, colW - 32), x + 18, kpiY + 74);

    ctx.fillStyle = '#64748B';
    ctx.font = '500 14px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(truncateText(ctx, kpi.sub, colW - 32), x + 18, kpiY + 102);
  });

  // Language Composition Bar
  const barY = 420;
  const barH = 18;
  const topLangs = result.languages.slice(0, 6);
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '600 16px system-ui, -apple-system, sans-serif';
  ctx.fillText(t.sectionLanguagesTitle, padX, barY - 12);

  drawRoundedRect(ctx, padX, barY, innerWidth, barH, 9);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(padX, barY, innerWidth, barH);

  let cursorX = padX;
  for (const item of topLangs) {
    const segW = Math.max(4, (item.percentage / 100) * innerWidth);
    ctx.fillStyle = item.color;
    ctx.fillRect(cursorX, barY, segW, barH);
    cursorX += segW;
  }
  ctx.restore();

  // Language Legend Row
  let legendX = padX;
  const legendY = 474;
  ctx.font = '500 16px system-ui, -apple-system, sans-serif';
  for (const item of topLangs.slice(0, 5)) {
    const label = `${item.name} ${item.percentage.toFixed(1)}%`;
    const itemWidth = ctx.measureText(label).width + 38;
    if (legendX + itemWidth > width - padX) break;

    drawRoundedRect(ctx, legendX, legendY - 12, 12, 12, 3);
    ctx.fillStyle = item.color;
    ctx.fill();

    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(label, legendX + 20, legendY);
    legendX += itemWidth;
  }

  // Footer Bar
  ctx.fillStyle = '#64748B';
  ctx.font = '500 15px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(t.footerNote, padX, height - 68);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode PNG image'));
    }, 'image/png');
  });
}
