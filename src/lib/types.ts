export type AppLanguage = 'en' | 'ar';

export interface WeeklyCommitBucket {
  label: string;
  commits: number;
}

export interface CommitActivitySummary {
  lastCommitAt: string | null;
  commitsLast30Days: number;
  commitsLast30DaysCapped: boolean;
  commitsPerWeek: number;
  sampledCommits: number;
  weeklyBuckets: WeeklyCommitBucket[];
}

export interface RepoMetadata {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  avatarUrl: string | null;
  defaultBranch: string;
  stars: number;
  forks: number;
  license: string | null;
  repoSizeKb: number;
  updatedAt: string | null;
  pushedAt: string | null;
  openPullRequests: number | null;
  activity: CommitActivitySummary | null;
}

export interface LanguageStat {
  name: string;
  color: string;
  lines: number;
  codeLines: number;
  blankLines: number;
  files: number;
  sizeBytes: number;
  percentage: number;
}

export interface AnalyzedFile {
  path: string;
  name: string;
  extension: string;
  language: string;
  color: string;
  lines: number;
  codeLines: number;
  blankLines: number;
  commentLines?: number;
  complexity?: number;
  maxNesting?: number;
  functionCount?: number;
  sizeBytes: number;
}

export type RefactoringCategory =
  | 'extract-functions'
  | 'flatten-nesting'
  | 'simplify-conditionals'
  | 'split-module'
  | 'add-documentation';

export interface RefactoringRecommendation {
  path: string;
  language: string;
  color: string;
  lines: number;
  codeLines: number;
  sizeBytes: number;
  complexity: number;
  maxNesting: number;
  functionCount: number;
  severity: 'critical' | 'high' | 'moderate';
  categories: RefactoringCategory[];
}

export interface ComplexityMetrics {
  score: number;
  avgComplexity: number;
  maxComplexity: number;
  highComplexityFilesCount: number;
  avgNestingDepth: number;
  logicFilesCount: number;
  recommendations: RefactoringRecommendation[];
}

export interface CodeHealthMetrics {
  score: number;
  commentScore: number;
  fileSizeScore: number;
  complexityScore?: number;
  commentLines: number;
  commentCapableLines: number;
  commentRatioPct: number;
  commentDataAvailable: boolean;
  avgFileSizeBytes: number;
  medianFileSizeBytes: number;
  oversizedFilesCount: number;
  healthySizeFilesPct: number;
  complexity?: ComplexityMetrics;
}

export interface AnalysisSummary {
  totalLines: number;
  codeLines: number;
  blankLines: number;
  commentLines?: number;
  totalFiles: number;
  analyzedFiles: number;
  skippedBinaryFiles: number;
  skippedLargeFiles: number;
  totalSizeBytes: number;
  languageCount: number;
  analysisDurationMs: number;
  filesTruncated: boolean;
  health?: CodeHealthMetrics;
}

export interface HistoricalLanguageStat {
  name: string;
  color: string;
  lines: number;
  codeLines: number;
  percentage: number;
}

export interface HistoricalLanguageSnapshot {
  snapshotCommitSha: string;
  snapshotDate: string;
  totalLines: number;
  codeLines: number;
  languages: HistoricalLanguageStat[];
}

export interface MonthlyLanguagePoint {
  lines: number;
  codeLines: number;
  files: number;
  newFiles: number;
  percentage: number;
}

export interface LanguageAdoptionMonth {
  monthKey: string;
  timestamp: string;
  languages: Record<string, MonthlyLanguagePoint>;
}

export interface LanguageAdoptionSummaryItem {
  name: string;
  color: string;
  startCodeLines: number;
  endCodeLines: number;
  deltaCodeLines: number;
  startPercentage: number;
  endPercentage: number;
  deltaPercentage: number;
  startFiles: number;
  endFiles: number;
  createdFiles12m: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface LanguageAdoptionTrend {
  source: 'snapshots' | 'file-creations';
  topLanguages: Array<{ name: string; color: string }>;
  months: LanguageAdoptionMonth[];
  summary: LanguageAdoptionSummaryItem[];
}

export interface AnalysisResult {
  repository: RepoMetadata;
  summary: AnalysisSummary;
  languages: LanguageStat[];
  files: AnalyzedFile[];
  analyzedAt: string;
  languageHistory?: HistoricalLanguageSnapshot | null;
  languageAdoption?: LanguageAdoptionTrend | null;
}

export type ProgressStage =
  | 'connecting'
  | 'metadata'
  | 'downloading'
  | 'parsing'
  | 'complete';

export interface AnalysisProgressEvent {
  type: 'progress';
  stage: ProgressStage;
  progress: number;
  bytesDownloaded: number;
  totalBytes: number | null;
  filesProcessed: number;
  linesCounted: number;
  currentFile?: string;
}

export interface AnalysisCompleteEvent {
  type: 'complete';
  data: AnalysisResult;
}

export interface AnalysisErrorEvent {
  type: 'error';
  code: string;
  message: string;
}

export type StreamEvent =
  | AnalysisProgressEvent
  | AnalysisCompleteEvent
  | AnalysisErrorEvent;
