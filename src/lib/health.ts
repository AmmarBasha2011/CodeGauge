import type { AnalysisResult, CodeHealthMetrics } from './types.ts';

export function resolveCodeHealth(data: AnalysisResult): CodeHealthMetrics {
  if (data.summary.health) {
    return data.summary.health;
  }

  const files = data.files;
  const count = files.length;
  if (count === 0) {
    return {
      score: 0,
      commentScore: 0,
      fileSizeScore: 0,
      commentLines: 0,
      commentCapableLines: 0,
      commentRatioPct: 0,
      commentDataAvailable: false,
      avgFileSizeBytes: 0,
      medianFileSizeBytes: 0,
      oversizedFilesCount: 0,
      healthySizeFilesPct: 100,
    };
  }

  const OVERSIZED_BYTES = 50 * 1024;
  const sizes = files.map((f) => f.sizeBytes).sort((a, b) => a - b);
  const mid = Math.floor(sizes.length / 2);
  const medianFileSizeBytes =
    sizes.length % 2 === 0
      ? Math.round((sizes[mid - 1] + sizes[mid]) / 2)
      : sizes[mid];
  const sumSampleBytes = sizes.reduce((acc, s) => acc + s, 0);
  const avgFileSizeBytes = Math.round(
    (data.summary.totalSizeBytes > 0 ? data.summary.totalSizeBytes : sumSampleBytes) /
      Math.max(count, data.summary.analyzedFiles || count)
  );

  let oversizedFilesCount = 0;
  let emptyFilesCount = 0;
  for (const f of files) {
    if (f.sizeBytes > OVERSIZED_BYTES) oversizedFilesCount += 1;
    if (f.lines === 0) emptyFilesCount += 1;
  }

  const oversizedRatio = oversizedFilesCount / count;
  const emptyRatio = emptyFilesCount / count;
  const avgKb = avgFileSizeBytes / 1024;

  let fileSizeScore = 50;
  fileSizeScore -= Math.min(25, oversizedRatio * 125);
  if (avgKb > 20) {
    fileSizeScore -= Math.min(15, ((avgKb - 20) / 80) * 15);
  }
  if (emptyRatio > 0.1) {
    fileSizeScore -= Math.min(10, (emptyRatio - 0.1) * 50);
  }
  const roundedFileSizeScore = Math.max(0, Math.min(50, Math.round(fileSizeScore)));
  const commentScore = 35;

  return {
    score: Math.max(0, Math.min(100, commentScore + roundedFileSizeScore)),
    commentScore,
    fileSizeScore: roundedFileSizeScore,
    commentLines: 0,
    commentCapableLines: 0,
    commentRatioPct: 0,
    commentDataAvailable: false,
    avgFileSizeBytes,
    medianFileSizeBytes,
    oversizedFilesCount,
    healthySizeFilesPct: Number(
      (((count - oversizedFilesCount) / count) * 100).toFixed(1)
    ),
  };
}

export function computeCodeSimplicity(data: AnalysisResult): {
  score: number;
  avgLinesPerFile: number;
} {
  const analyzedCount = Math.max(1, data.summary.analyzedFiles || data.files.length);
  const avgLinesPerFile = Math.round(data.summary.codeLines / analyzedCount);

  if (data.files.length === 0 && data.summary.analyzedFiles === 0) {
    return { score: 0, avgLinesPerFile: 0 };
  }

  const sampleCount = Math.max(1, data.files.length);
  const largeLogicFiles = data.files.filter((f) => f.codeLines > 400).length;
  const largeFileRatio = data.files.length > 0 ? largeLogicFiles / sampleCount : 0;

  const avgPenalty = Math.max(0, avgLinesPerFile - 80) * 0.14;
  const ratioPenalty = largeFileRatio * 85;
  const score = Math.max(10, Math.min(100, Math.round(100 - avgPenalty - ratioPenalty)));

  return { score, avgLinesPerFile };
}

export function computeCodeDensity(data: AnalysisResult): number {
  if (data.summary.totalLines <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((data.summary.codeLines / data.summary.totalLines) * 100))
  );
}
