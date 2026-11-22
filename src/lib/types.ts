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
  sizeBytes: number;
}

export interface CodeHealthMetrics {
  score: number;
  commentScore: number;
  fileSizeScore: number;
  commentLines: number;
  commentCapableLines: number;
  commentRatioPct: number;
  commentDataAvailable: boolean;
  avgFileSizeBytes: number;
  medianFileSizeBytes: number;
  oversizedFilesCount: number;
  healthySizeFilesPct: number;
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

export interface AnalysisResult {
  repository: RepoMetadata;
  summary: AnalysisSummary;
  languages: LanguageStat[];
  files: AnalyzedFile[];
  analyzedAt: string;
  languageHistory?: HistoricalLanguageSnapshot | null;
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
