import type {
  AnalysisResult,
  AnalyzedFile,
  CodeHealthMetrics,
  ComplexityMetrics,
  RefactoringCategory,
  RefactoringRecommendation,
} from './types.ts';

const NON_LOGIC_LANGUAGES = new Set([
  'JSON',
  'Text',
  'CSV',
  'Markdown',
  'MDX',
  'reStructuredText',
  'Other',
  'YAML',
  'TOML',
  'XML',
  'SVG',
  'HTML',
  'CSS',
  'SCSS',
  'Sass',
  'Less',
  'Ignore List',
  'Git Config',
  'EditorConfig',
  'Config',
  'INI',
  'GraphQL',
]);

function deriveFallbackComplexity(files: AnalyzedFile[]): ComplexityMetrics {
  const logicFiles = files.filter((f) => !NON_LOGIC_LANGUAGES.has(f.language));
  if (logicFiles.length === 0) {
    return {
      score: 100,
      avgComplexity: 1,
      maxComplexity: 1,
      highComplexityFilesCount: 0,
      avgNestingDepth: 0,
      logicFilesCount: 0,
      recommendations: [],
    };
  }

  let totalComplexity = 0;
  let totalNesting = 0;
  let maxComplexity = 1;
  let highComplexityFilesCount = 0;
  const recommendations: RefactoringRecommendation[] = [];

  for (const f of logicFiles) {
    const c = f.complexity ?? Math.max(1, Math.round(1 + f.codeLines / 14));
    const n =
      f.maxNesting ??
      Math.min(10, Math.max(1, Math.round(Math.log2(Math.max(2, f.codeLines / 12)))));
    const fnCount = f.functionCount ?? Math.max(1, Math.round(f.codeLines / 28));

    totalComplexity += c;
    totalNesting += n;
    if (c > maxComplexity) maxComplexity = c;
    if (c >= 15 || (n >= 5 && f.codeLines >= 100)) {
      highComplexityFilesCount += 1;
      const severity: RefactoringRecommendation['severity'] =
        c >= 50 || (n >= 7 && c >= 25)
          ? 'critical'
          : c >= 25 || n >= 5
            ? 'high'
            : 'moderate';
      const categories: RefactoringCategory[] = [];
      if (n >= 4) categories.push('flatten-nesting');
      if (c >= 18 && c / Math.max(1, fnCount) >= 7) {
        categories.push('extract-functions');
      }
      if (c >= 22) categories.push('simplify-conditionals');
      if (f.codeLines >= 350 || f.sizeBytes >= 40 * 1024) {
        categories.push('split-module');
      }
      if (
        (f.commentLines ?? 0) / Math.max(1, f.codeLines) < 0.05 &&
        c >= 18
      ) {
        categories.push('add-documentation');
      }
      if (categories.length === 0) categories.push('extract-functions');

      recommendations.push({
        path: f.path,
        language: f.language,
        color: f.color,
        lines: f.lines,
        codeLines: f.codeLines,
        sizeBytes: f.sizeBytes,
        complexity: c,
        maxNesting: n,
        functionCount: fnCount,
        severity,
        categories: categories.slice(0, 3),
      });
    }
  }

  recommendations.sort((a, b) => {
    const rankA = a.complexity * 1.5 + a.maxNesting * 4 + a.codeLines / 60;
    const rankB = b.complexity * 1.5 + b.maxNesting * 4 + b.codeLines / 60;
    return rankB - rankA;
  });

  const avgComplexity = Number((totalComplexity / logicFiles.length).toFixed(1));
  const avgNestingDepth = Number((totalNesting / logicFiles.length).toFixed(1));
  const highRatio = highComplexityFilesCount / logicFiles.length;

  const avgPenalty = Math.max(0, avgComplexity - 5) * 2.2;
  const highRatioPenalty = highRatio * 95;
  const nestingPenalty = Math.max(0, avgNestingDepth - 2.2) * 8;
  const peakPenalty = Math.max(0, maxComplexity - 40) * 0.15;

  const score = Math.max(
    5,
    Math.min(
      100,
      Math.round(100 - avgPenalty - highRatioPenalty - nestingPenalty - peakPenalty)
    )
  );

  return {
    score,
    avgComplexity,
    maxComplexity,
    highComplexityFilesCount,
    avgNestingDepth,
    logicFilesCount: logicFiles.length,
    recommendations: recommendations.slice(0, 8),
  };
}

export function resolveCodeHealth(data: AnalysisResult): CodeHealthMetrics {
  const existing = data.summary.health;
  if (existing && existing.complexity && typeof existing.complexityScore === 'number') {
    return existing;
  }

  if (existing) {
    const complexity = existing.complexity ?? deriveFallbackComplexity(data.files);
    const commentScore = Math.round((existing.commentScore / 50) * 35);
    const fileSizeScore = Math.round((existing.fileSizeScore / 50) * 35);
    const complexityScore = Math.round((complexity.score / 100) * 30);
    return {
      ...existing,
      commentScore,
      fileSizeScore,
      complexityScore,
      score: Math.max(0, Math.min(100, commentScore + fileSizeScore + complexityScore)),
      complexity,
    };
  }

  const files = data.files;
  const count = files.length;
  if (count === 0) {
    return {
      score: 0,
      commentScore: 0,
      fileSizeScore: 0,
      complexityScore: 0,
      commentLines: 0,
      commentCapableLines: 0,
      commentRatioPct: 0,
      commentDataAvailable: false,
      avgFileSizeBytes: 0,
      medianFileSizeBytes: 0,
      oversizedFilesCount: 0,
      healthySizeFilesPct: 100,
      complexity: deriveFallbackComplexity([]),
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

  let rawFileSizeScore = 50;
  rawFileSizeScore -= Math.min(25, oversizedRatio * 125);
  if (avgKb > 20) {
    rawFileSizeScore -= Math.min(15, ((avgKb - 20) / 80) * 15);
  }
  if (emptyRatio > 0.1) {
    rawFileSizeScore -= Math.min(10, (emptyRatio - 0.1) * 50);
  }
  rawFileSizeScore = Math.max(0, Math.min(50, Math.round(rawFileSizeScore)));
  const commentScore = Math.round((35 / 50) * 35);
  const fileSizeScore = Math.round((rawFileSizeScore / 50) * 35);
  const complexity = deriveFallbackComplexity(files);
  const complexityScore = Math.round((complexity.score / 100) * 30);

  return {
    score: Math.max(0, Math.min(100, commentScore + fileSizeScore + complexityScore)),
    commentScore,
    fileSizeScore,
    complexityScore,
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
    complexity,
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
