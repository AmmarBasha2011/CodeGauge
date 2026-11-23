import type { AppLanguage } from './types.ts';

export interface Translations {
  brand: string;
  navOverview: string;
  navLanguages: string;
  navFiles: string;
  switchLangLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  inputPlaceholder: string;
  analyzeButton: string;
  analyzingButton: string;
  cancelButton: string;
  sampleLabel: string;
  stageConnecting: string;
  stageMetadata: string;
  stageDownloading: string;
  stageParsing: string;
  stageComplete: string;
  progressFilesScanned: string;
  progressLinesCounted: string;
  progressDownloaded: string;
  progressCurrentFile: string;
  exportPdf: string;
  exportingPdf: string;
  branchLabel: string;
  starsLabel: string;
  forksLabel: string;
  licenseLabel: string;
  kpiTotalLines: string;
  kpiCodeLinesSub: string;
  kpiLanguages: string;
  kpiPrimaryLangSub: string;
  kpiAnalyzedFiles: string;
  kpiSkippedBinarySub: string;
  kpiTotalSize: string;
  kpiDurationSub: string;
  sectionLanguagesTitle: string;
  sectionLanguagesSubtitle: string;
  colLanguage: string;
  colFiles: string;
  colLines: string;
  colCodeLines: string;
  colShare: string;
  colSize: string;
  allLanguagesOption: string;
  allExtensionsOption: string;
  sectionFilesTitle: string;
  sectionFilesSubtitle: string;
  searchFilesPlaceholder: string;
  filterLanguageLabel: string;
  filterExtensionLabel: string;
  filterSizePresetLabel: string;
  sizePresetAll: string;
  sizePresetTiny: string;
  sizePresetSmall: string;
  sizePresetMedium: string;
  sizePresetLarge: string;
  minSizeKbLabel: string;
  maxSizeKbLabel: string;
  sortLabel: string;
  sortLinesDesc: string;
  sortLinesAsc: string;
  sortSizeDesc: string;
  sortSizeAsc: string;
  sortPathAsc: string;
  resetFilters: string;
  showingFilesSummary: string;
  colPath: string;
  colExtension: string;
  noMatchingFiles: string;
  noMatchingFilesHint: string;
  prevPage: string;
  nextPage: string;
  pageOf: string;
  emptyStateTitle: string;
  emptyStateDesc: string;
  featureAplTitle: string;
  featureAplDesc: string;
  featureFilterTitle: string;
  featureFilterDesc: string;
  featurePdfTitle: string;
  featurePdfDesc: string;
  errorTitle: string;
  errorInvalidUrl: string;
  errorNotFound: string;
  errorRateLimit: string;
  errorArchiveTooLarge: string;
  errorGeneric: string;
  truncatedNotice: string;
  pdfTitle: string;
  pdfGeneratedOn: string;
  pdfTopFilesTitle: string;
  pdfFilterApplied: string;
  footerNote: string;
  compareModeButton: string;
  closeCompareInput: string;
  secondRepoPlaceholder: string;
  addSecondRepoButton: string;
  removeSecondRepo: string;
  repoALabel: string;
  repoBLabel: string;
  comparisonSectionTitle: string;
  comparisonSectionSubtitle: string;
  comparisonMetricCol: string;
  comparisonDiffCol: string;
  languageComparisonTitle: string;
  languageComparisonSubtitle: string;
  barChartTitle: string;
  barChartSubtitle: string;
  totalLinesLegend: string;
  codeLinesLegend: string;
  navComparison: string;
  comparingFileExplorerLabel: string;
  pdfComparisonTitle: string;
  errorSameRepo: string;
  pwaInstallButton: string;
  pwaInstallIosButton: string;
  pwaIosModalTitle: string;
  pwaIosStep1: string;
  pwaIosStep2: string;
  pwaCloseModal: string;
  pwaOfflineBanner: string;
  searchScopeFilename: string;
  searchScopePath: string;
  searchFilenamePlaceholder: string;
  clearSearchLabel: string;
  activitySectionTitle: string;
  activitySectionSubtitle: string;
  lastUpdatedLabel: string;
  openPrsLabel: string;
  commitFrequencyLabel: string;
  commitsPerWeekUnit: string;
  commitsLast30DaysSub: string;
  weeklyCommitsChartTitle: string;
  weeklyTrendChartTitle: string;
  weeklyTrendChartSubtitle: string;
  commitsUnitLabel: string;
  fourWeekAvgLabel: string;
  unavailableLabel: string;
  lastCommitLabel: string;
  healthGaugeLabel: string;
  healthRatingHealthy: string;
  healthRatingModerate: string;
  healthRatingNeedsAttention: string;
  healthPopoverTitle: string;
  healthCommentRatioLabel: string;
  healthCommentScoreLabel: string;
  healthFileSizeScoreLabel: string;
  healthMedianSizeLabel: string;
  healthOversizedFilesLabel: string;
  healthNoCommentData: string;
  healthRadarTitle: string;
  healthRadarSubtitle: string;
  radarAxisOverall: string;
  radarAxisComments: string;
  radarAxisFileSize: string;
  radarAxisComplexity: string;
  radarAxisDensity: string;
  radarLinesPerFileUnit: string;
  shareButtonLabel: string;
  shareModalTitle: string;
  shareModalSubtitle: string;
  shareLinkLabel: string;
  shareCopyLinkButton: string;
  shareCopiedLabel: string;
  shareCardPreviewLabel: string;
  shareDownloadImageButton: string;
  shareCopyImageButton: string;
  shareSocialPlatformsLabel: string;
  shareTwitterLabel: string;
  shareLinkedInLabel: string;
  shareFacebookLabel: string;
  radarModePercentage: string;
  radarModeRawLines: string;
  radarAxisBlankLines: string;
  radarAxisCommentLines: string;
  radarAxisPrimaryLangLines: string;
  pdfIncludeDetailedBreakdown: string;
  pdfDetailedBreakdownTitle: string;
  pdfRankCol: string;
  langGrowthTitle: string;
  langGrowthSubtitle: string;
  langGrowthLegendPrevious: string;
  langGrowthLegendCurrent: string;
  langGrowthMetricLines: string;
  langGrowthMetricShare: string;
  langGrowthNoChange: string;
  heatmapSectionTitle: string;
  heatmapSectionSubtitle: string;
  heatmapModeAll: string;
  heatmapModeSize: string;
  heatmapModeComplexity: string;
  heatmapLegendLow: string;
  heatmapLegendModerate: string;
  heatmapLegendHigh: string;
  heatmapLegendHotspot: string;
  heatmapRankCol: string;
  heatmapLargerTag: string;
  heatmapComplexTag: string;
  navComplexity: string;
  healthComplexityScoreLabel: string;
  healthComplexityAvgSub: string;
  complexitySectionTitle: string;
  complexitySectionSubtitle: string;
  complexityScoreLabel: string;
  complexityAvgLabel: string;
  complexityAvgSub: string;
  complexityPeakLabel: string;
  complexityPeakSub: string;
  complexityFlaggedLabel: string;
  complexityFlaggedSub: string;
  complexityTierLow: string;
  complexityTierModerate: string;
  complexityTierHigh: string;
  complexityFilterAll: string;
  complexityFilterCriticalHigh: string;
  complexityFilterNesting: string;
  complexityFilterLarge: string;
  complexityMetricValue: string;
  complexityDepthLabel: string;
  complexityFunctionsLabel: string;
  complexitySeverityCritical: string;
  complexitySeverityHigh: string;
  complexitySeverityModerate: string;
  recTitleExtractFunctions: string;
  recDescExtractFunctions: string;
  recTitleFlattenNesting: string;
  recDescFlattenNesting: string;
  recTitleSimplifyConditionals: string;
  recDescSimplifyConditionals: string;
  recTitleSplitModule: string;
  recDescSplitModule: string;
  recTitleAddDocumentation: string;
  recDescAddDocumentation: string;
  complexityCleanTitle: string;
  complexityCleanDesc: string;
  complexityNoMatchFilter: string;
  kpiTooltipTotalLines: string;
  kpiTooltipLanguages: string;
  kpiTooltipAnalyzedFiles: string;
  kpiTooltipTotalSize: string;
  kpiTooltipComplexityScore: string;
  kpiTooltipComplexityAvg: string;
  kpiTooltipComplexityPeak: string;
  kpiTooltipComplexityFlagged: string;
  kpiTooltipLastUpdated: string;
  kpiTooltipOpenPrs: string;
  kpiTooltipCommitFrequency: string;
  hotspotTreemapTitle: string;
  hotspotTreemapSubtitle: string;
  hotspotRootLabel: string;
  hotspotZoomOutButton: string;
  hotspotLegendLow: string;
  hotspotLegendModerate: string;
  hotspotLegendElevated: string;
  hotspotLegendCritical: string;
  hotspotLegendData: string;
  hotspotClickFolderHint: string;
  hotspotClickFileHint: string;
  hotspotOtherSmallItems: string;
  hotspotFolderSummary: string;
  hotspotSelectedFileTitle: string;
  hotspotOpenInExplorer: string;
  hotspotEmptyDir: string;
  adoptionTrendTitle: string;
  adoptionTrendSubtitle: string;
  adoptionIncreasingLabel: string;
  adoptionDecreasingLabel: string;
  adoptionStableLabel: string;
  adoptionNewFilesMonth: string;
  adoptionCreated12m: string;
  adoptionNoChangeLabel: string;
  fileTypeSummaryTitle: string;
  fileTypeSummarySubtitle: string;
  fileTypeMetricShare: string;
  fileTypeMetricLines: string;
  fileTypeMetricFiles: string;
  fileCategorySource: string;
  fileCategoryTests: string;
  fileCategoryDocs: string;
  fileCategoryConfig: string;
  fileCategoryOther: string;
  fileCategoryCol: string;
}

const EN: Translations = {
  brand: 'CodeGauge',
  navOverview: 'Overview',
  navLanguages: 'Languages',
  navFiles: 'Files',
  switchLangLabel: 'العربية',
  heroTitle: 'Measure every line of code in any GitHub repository',
  heroSubtitle:
    'Inspect total lines of code, detect every programming language by extension (including APL via .apl), filter files by type and size, and export a formatted PDF report.',
  inputPlaceholder: 'https://github.com/owner/repository or owner/repo',
  analyzeButton: 'Analyze Repository',
  analyzingButton: 'Analyzing...',
  cancelButton: 'Cancel',
  sampleLabel: 'Try a repository:',
  stageConnecting: 'Connecting to GitHub',
  stageMetadata: 'Fetching repository metadata',
  stageDownloading: 'Downloading repository archive',
  stageParsing: 'Counting lines & detecting languages',
  stageComplete: 'Analysis complete',
  progressFilesScanned: 'Files scanned',
  progressLinesCounted: 'Lines counted',
  progressDownloaded: 'Downloaded',
  progressCurrentFile: 'Current file',
  exportPdf: 'Export PDF',
  exportingPdf: 'Generating PDF...',
  branchLabel: 'Branch',
  starsLabel: 'Stars',
  forksLabel: 'Forks',
  licenseLabel: 'License',
  kpiTotalLines: 'Total Lines of Code',
  kpiCodeLinesSub: '{code} non-blank code lines',
  kpiLanguages: 'Languages Detected',
  kpiPrimaryLangSub: 'Primary: {lang}',
  kpiAnalyzedFiles: 'Analyzed Source Files',
  kpiSkippedBinarySub: '{skipped} binary files skipped',
  kpiTotalSize: 'Source Footprint',
  kpiDurationSub: 'Analyzed in {seconds}s',
  sectionLanguagesTitle: 'Language Breakdown',
  sectionLanguagesSubtitle:
    'Lines and file distribution detected by file extension. Click any language row or bar to filter the file explorer.',
  colLanguage: 'Language',
  colFiles: 'Files',
  colLines: 'Total Lines',
  colCodeLines: 'Code Lines',
  colShare: 'Share',
  colSize: 'Size',
  allLanguagesOption: 'All Languages',
  allExtensionsOption: 'All Extensions',
  sectionFilesTitle: 'File Explorer & Filter',
  sectionFilesSubtitle:
    'Search across repository paths and filter by language, file extension, and exact byte size.',
  searchFilesPlaceholder: 'Search path or filename (e.g. src/, .apl, index)...',
  filterLanguageLabel: 'Language',
  filterExtensionLabel: 'File Type',
  filterSizePresetLabel: 'Size Range',
  sizePresetAll: 'All Sizes',
  sizePresetTiny: 'Tiny (< 1 KB)',
  sizePresetSmall: 'Small (1 – 10 KB)',
  sizePresetMedium: 'Medium (10 – 100 KB)',
  sizePresetLarge: 'Large (> 100 KB)',
  minSizeKbLabel: 'Min KB',
  maxSizeKbLabel: 'Max KB',
  sortLabel: 'Sort By',
  sortLinesDesc: 'Lines (High to Low)',
  sortLinesAsc: 'Lines (Low to High)',
  sortSizeDesc: 'Size (Largest First)',
  sortSizeAsc: 'Size (Smallest First)',
  sortPathAsc: 'Path (A – Z)',
  resetFilters: 'Reset Filters',
  showingFilesSummary: 'Showing {shown} of {total} files · {lines} lines · {size}',
  colPath: 'File Path',
  colExtension: 'Ext',
  noMatchingFiles: 'No files match the active filters',
  noMatchingFilesHint: 'Adjust your search query, file extension, or size bounds to see results.',
  prevPage: 'Previous',
  nextPage: 'Next',
  pageOf: 'Page {page} of {pages}',
  emptyStateTitle: 'Ready to inspect a repository',
  emptyStateDesc:
    'Paste any public GitHub repository URL above to stream its archive, count every line of source code, and generate a downloadable PDF summary.',
  featureAplTitle: 'Exact Language & APL Detection',
  featureAplDesc:
    'Identifies 100+ extensions automatically, including dedicated APL detection for .apl, .aplf, .apln, and .dyalog source files.',
  featureFilterTitle: 'Granular File & Size Search',
  featureFilterDesc:
    'Filter thousands of source files instantaneously by path substring, language, extension, and custom KB size ranges.',
  featurePdfTitle: 'Full PDF Report Export',
  featurePdfDesc:
    'Download a structured, multi-page A4 PDF report with KPIs, language distribution, and file breakdowns in English or Arabic.',
  errorTitle: 'Unable to analyze repository',
  errorInvalidUrl:
    'Please enter a valid public GitHub repository URL (e.g. https://github.com/owner/repo) or owner/repo.',
  errorNotFound:
    'Repository or branch was not found. Make sure the repository exists and is public.',
  errorRateLimit:
    'GitHub rate limit reached. Please wait a minute before trying another repository.',
  errorArchiveTooLarge:
    'This repository archive exceeds the 250 MB single-pass analysis limit.',
  errorGeneric: 'An unexpected error occurred while analyzing the repository.',
  truncatedNotice:
    'Showing the top 15,000 files in the interactive explorer; summary totals reflect the entire repository.',
  pdfTitle: 'Repository Code Analysis Report',
  pdfGeneratedOn: 'Generated on',
  pdfTopFilesTitle: 'Analyzed Files Breakdown',
  pdfFilterApplied: 'Active Filter',
  footerNote: 'CodeGauge · Public GitHub Repository Code Metrics',
  compareModeButton: 'Compare with 2nd Repo',
  closeCompareInput: 'Hide 2nd Repo',
  secondRepoPlaceholder: 'Second repository URL (e.g. https://github.com/owner/repo-2)',
  addSecondRepoButton: 'Compare Repositories',
  removeSecondRepo: 'Clear Comparison',
  repoALabel: 'Repository A',
  repoBLabel: 'Repository B',
  comparisonSectionTitle: 'Side-by-Side Repository Comparison',
  comparisonSectionSubtitle:
    'Direct comparison of total lines of code, source files, footprint, and language composition.',
  comparisonMetricCol: 'Metric',
  comparisonDiffCol: 'Difference (A vs B)',
  languageComparisonTitle: 'Language Distribution Comparison',
  languageComparisonSubtitle:
    'Grouped code line distribution across the top languages in both repositories.',
  barChartTitle: 'Code Lines per Language',
  barChartSubtitle: 'Top languages compared by total lines and non-blank code lines.',
  totalLinesLegend: 'Total Lines',
  codeLinesLegend: 'Code Lines (Non-Blank)',
  navComparison: 'Comparison',
  comparingFileExplorerLabel: 'Inspecting files for',
  pdfComparisonTitle: 'Side-by-Side Comparison Summary',
  errorSameRepo: 'Please enter a different repository URL to compare.',
  pwaInstallButton: 'Install App',
  pwaInstallIosButton: 'Install on iOS',
  pwaIosModalTitle: 'Install CodeGauge on iPhone / iPad',
  pwaIosStep1: 'Tap the Share button in the Safari toolbar.',
  pwaIosStep2: 'Scroll down and tap "Add to Home Screen".',
  pwaCloseModal: 'Close',
  pwaOfflineBanner: 'Offline Mode — Cached interface & last report available',
  searchScopeFilename: 'Filename',
  searchScopePath: 'Full Path',
  searchFilenamePlaceholder: 'Search within filenames (e.g. App, config, .apl)...',
  clearSearchLabel: 'Clear search',
  activitySectionTitle: 'Repository Activity & Commit Frequency',
  activitySectionSubtitle:
    'Recent GitHub update timestamp, open pull requests, and commit cadence on the analyzed branch.',
  lastUpdatedLabel: 'Last Updated',
  openPrsLabel: 'Open Pull Requests',
  commitFrequencyLabel: 'Commit Frequency',
  commitsPerWeekUnit: '{count} / wk',
  commitsLast30DaysSub: '{count} commits in last 30d',
  weeklyCommitsChartTitle: 'Weekly Commit Cadence (Last 8 Weeks)',
  weeklyTrendChartTitle: 'Weekly Activity Trend',
  weeklyTrendChartSubtitle: 'Commit frequency over the last 4 weeks',
  commitsUnitLabel: 'commits',
  fourWeekAvgLabel: '4-wk avg: {count} / wk',
  unavailableLabel: 'Unavailable',
  lastCommitLabel: 'Latest commit',
  healthGaugeLabel: 'Code Health',
  healthRatingHealthy: 'Healthy',
  healthRatingModerate: 'Moderate',
  healthRatingNeedsAttention: 'Needs Attention',
  healthPopoverTitle: 'Code Health Breakdown',
  healthCommentRatioLabel: 'Comment-to-Code Ratio',
  healthCommentScoreLabel: 'Documentation Score',
  healthFileSizeScoreLabel: 'File Size Distribution',
  healthMedianSizeLabel: 'Median File Size',
  healthOversizedFilesLabel: 'Files > 50 KB',
  healthNoCommentData: 'No comment-capable code files detected',
  healthRadarTitle: 'Code Health Score Radar',
  healthRadarSubtitle:
    'Normalized 0–100 comparison of documentation, file size distribution, code simplicity, and density.',
  radarAxisOverall: 'Overall Health',
  radarAxisComments: 'Comment Ratio',
  radarAxisFileSize: 'File Size Dist.',
  radarAxisComplexity: 'Low Complexity',
  radarAxisDensity: 'Code Density',
  radarLinesPerFileUnit: '{lines} lines/file',
  shareButtonLabel: 'Share',
  shareModalTitle: 'Share Repository Report',
  shareModalSubtitle:
    'Copy a direct report link, download a summary card image, or post to social media.',
  shareLinkLabel: 'Shareable Report Link',
  shareCopyLinkButton: 'Copy Link',
  shareCopiedLabel: 'Copied',
  shareCardPreviewLabel: 'Summary Card Image',
  shareDownloadImageButton: 'Download PNG',
  shareCopyImageButton: 'Copy Image',
  shareSocialPlatformsLabel: 'Share on Social Media',
  shareTwitterLabel: 'X / Twitter',
  shareLinkedInLabel: 'LinkedIn',
  shareFacebookLabel: 'Facebook',
  radarModePercentage: 'Percentage (%)',
  radarModeRawLines: 'Raw Line Counts',
  radarAxisBlankLines: 'Blank Lines',
  radarAxisCommentLines: 'Comment Lines',
  radarAxisPrimaryLangLines: 'Primary Language',
  pdfIncludeDetailedBreakdown: 'Detailed Breakdown (Top 10)',
  pdfDetailedBreakdownTitle: 'Detailed Breakdown — Top 10 Largest Files by Lines of Code',
  pdfRankCol: '#',
  langGrowthTitle: 'Top 5 Languages Growth',
  langGrowthSubtitle:
    'Current language distribution compared against the historical snapshot from 1 month ago ({date}).',
  langGrowthLegendPrevious: '1 Month Ago',
  langGrowthLegendCurrent: 'Current',
  langGrowthMetricLines: 'Code Lines',
  langGrowthMetricShare: 'Share (%)',
  langGrowthNoChange: 'No change',
  heatmapSectionTitle: 'File Size & Complexity Heatmap',
  heatmapSectionSubtitle:
    'Highlights files that are significantly larger (in bytes) or more complex (in lines of code) between the two repositories.',
  heatmapModeAll: 'All Metrics',
  heatmapModeSize: 'Size (Bytes)',
  heatmapModeComplexity: 'Complexity (Lines)',
  heatmapLegendLow: 'Low',
  heatmapLegendModerate: 'Moderate',
  heatmapLegendHigh: 'High',
  heatmapLegendHotspot: 'Hotspot (≥1.5×)',
  heatmapRankCol: '#',
  heatmapLargerTag: '{ratio}× bytes',
  heatmapComplexTag: '{ratio}× lines',
  navComplexity: 'Complexity',
  healthComplexityScoreLabel: 'Cyclomatic Complexity',
  healthComplexityAvgSub: 'Avg M = {avg} across {files} code files',
  complexitySectionTitle: 'Cyclomatic Complexity & Refactoring Recommendations',
  complexitySectionSubtitle:
    'Structural complexity analysis across source files, highlighting control-flow hotspots and targeted refactoring actions.',
  complexityScoreLabel: 'Complexity Health Score',
  complexityAvgLabel: 'Average File Complexity',
  complexityAvgSub: 'Across {files} logic files · avg depth {depth}',
  complexityPeakLabel: 'Peak File Complexity',
  complexityPeakSub: 'Highest branch complexity in a single file',
  complexityFlaggedLabel: 'Refactoring Targets',
  complexityFlaggedSub: 'Files with complexity ≥ 15 or deep nesting',
  complexityTierLow: 'Low Complexity',
  complexityTierModerate: 'Moderate Complexity',
  complexityTierHigh: 'High Complexity',
  complexityFilterAll: 'All Flagged',
  complexityFilterCriticalHigh: 'Critical & High',
  complexityFilterNesting: 'Deep Nesting',
  complexityFilterLarge: 'Large Modules',
  complexityMetricValue: 'M = {value}',
  complexityDepthLabel: 'Depth {depth}',
  complexityFunctionsLabel: '{count} functions',
  complexitySeverityCritical: 'Critical',
  complexitySeverityHigh: 'High',
  complexitySeverityModerate: 'Moderate',
  recTitleExtractFunctions: 'Extract Helper Functions',
  recDescExtractFunctions:
    'High branch density relative to function count indicates monolithic routines; extract cohesive blocks into pure single-purpose helpers.',
  recTitleFlattenNesting: 'Flatten Deep Nesting',
  recDescFlattenNesting:
    'Control blocks reach {depth} levels of nesting; introduce early returns, guard clauses, and inverted conditionals.',
  recTitleSimplifyConditionals: 'Simplify Branching Logic',
  recDescSimplifyConditionals:
    'Dense decision trees (M = {complexity}) increase test surface; replace chained conditionals or switches with lookup maps or strategy dispatch.',
  recTitleSplitModule: 'Split Monolithic Module',
  recDescSplitModule:
    'Large file footprint ({lines} code lines) mixes multiple responsibilities; decompose into smaller feature-scoped modules.',
  recTitleAddDocumentation: 'Document Complex Branches',
  recDescAddDocumentation:
    'Minimal inline documentation for high control-flow complexity; document key invariants and edge-case branches before refactoring.',
  complexityCleanTitle: 'Clean Structural Complexity',
  complexityCleanDesc:
    'All analyzed source files stay below the high-complexity threshold (M < 15) with balanced nesting depth.',
  complexityNoMatchFilter: 'No flagged files match the selected complexity filter.',
  kpiTooltipTotalLines:
    'Sum of all lines (non-blank code lines + blank lines) across every parsed text/source file, excluding binaries and files over 5 MB.',
  kpiTooltipLanguages:
    'Count of distinct programming, markup, and configuration languages detected from file extensions and special filenames (including APL via .apl).',
  kpiTooltipAnalyzedFiles:
    'Number of text and source files successfully scanned from the repository archive; binary assets and files exceeding 5 MB are skipped.',
  kpiTooltipTotalSize:
    'Total uncompressed byte size of all analyzed source files, paired with the server archive download and parsing time.',
  kpiTooltipComplexityScore:
    'Weighted 0–100 health index (100 = cleanest) penalized by average McCabe complexity, share of flagged files, nesting depth, and peak complexity.',
  kpiTooltipComplexityAvg:
    'Mean McCabe cyclomatic complexity (M) per logic file, starting at 1 and adding control-flow branches (if, loops, switch/case, &&, ||, ?:, APL guards).',
  kpiTooltipComplexityPeak:
    'Highest McCabe cyclomatic complexity (M) measured in any single programming/scripting file across the repository.',
  kpiTooltipComplexityFlagged:
    'Source files flagged for refactoring due to M ≥ 15, deep block nesting (≥ 5 with 100+ code lines), or monolithic size (≥ 450 lines with M ≥ 10).',
  kpiTooltipLastUpdated:
    'Most recent push or repository metadata update timestamp reported by GitHub for this repository.',
  kpiTooltipOpenPrs:
    'Live count of currently open pull requests retrieved from the GitHub REST API.',
  kpiTooltipCommitFrequency:
    'Estimated commits per week and trailing 30-day commit volume sampled from up to 100 recent commits on the default branch.',
  hotspotTreemapTitle: 'Code Hotspot Directory Treemap',
  hotspotTreemapSubtitle:
    'Rectangle area reflects lines of code density; color indicates cyclomatic complexity. Click any folder to zoom in or click a file to inspect.',
  hotspotRootLabel: 'Root',
  hotspotZoomOutButton: 'Up One Level',
  hotspotLegendLow: 'Low (M < 10)',
  hotspotLegendModerate: 'Moderate (10–19)',
  hotspotLegendElevated: 'Elevated (20–34)',
  hotspotLegendCritical: 'Hotspot (M ≥ 35)',
  hotspotLegendData: 'Config / Docs',
  hotspotClickFolderHint: 'Click folder to zoom into contents',
  hotspotClickFileHint: 'Click file to inspect complexity details',
  hotspotOtherSmallItems: '{count} smaller items',
  hotspotFolderSummary: '{files} files · Avg M = {avg} · Peak M = {peak}',
  hotspotSelectedFileTitle: 'Selected File Hotspot',
  hotspotOpenInExplorer: 'Filter in File Explorer',
  hotspotEmptyDir: 'No non-empty source files found inside this folder.',
  adoptionTrendTitle: 'Language Adoption Trend (12 Months)',
  adoptionTrendSubtitle:
    'Tracks monthly file creations and codebase usage across the top 5 languages over the past 12 months.',
  adoptionIncreasingLabel: 'Increasing',
  adoptionDecreasingLabel: 'Decreasing',
  adoptionStableLabel: 'Stable',
  adoptionNewFilesMonth: '+{count} created',
  adoptionCreated12m: '{count} files created in 12m',
  adoptionNoChangeLabel: 'No net change',
  fileTypeSummaryTitle: 'File Type Distribution Comparison',
  fileTypeSummarySubtitle:
    'Compares how each repository allocates source code, tests, documentation, configuration, and markup across analyzed files.',
  fileTypeMetricShare: 'Share (%)',
  fileTypeMetricLines: 'Code Lines',
  fileTypeMetricFiles: 'File Count',
  fileCategorySource: 'Source Code',
  fileCategoryTests: 'Tests & Specs',
  fileCategoryDocs: 'Documentation',
  fileCategoryConfig: 'Config & Build',
  fileCategoryOther: 'Markup & Other',
  fileCategoryCol: 'File Category',
};

const AR: Translations = {
  brand: 'CodeGauge',
  navOverview: 'نظرة عامة',
  navLanguages: 'اللغات',
  navFiles: 'الملفات',
  switchLangLabel: 'English',
  heroTitle: 'احسب كل سطر برمجي في أي مستودع GitHub',
  heroSubtitle:
    'استعرض إجمالي أسطر الكود، وتعرف على جميع لغات البرمجة عبر الامتداد (بما في ذلك لغة APL عبر .apl)، وقم بتصفية الملفات حسب النوع والحجم، وتصدير تقرير PDF كامل.',
  inputPlaceholder: 'https://github.com/owner/repository أو owner/repo',
  analyzeButton: 'تحليل المستودع',
  analyzingButton: 'جارٍ التحليل...',
  cancelButton: 'إلغاء',
  sampleLabel: 'جرّب مستودعاً:',
  stageConnecting: 'جارٍ الاتصال بـ GitHub',
  stageMetadata: 'جلب بيانات المستودع',
  stageDownloading: 'تحميل أرشيف المستودع',
  stageParsing: 'عدّ الأسطر وتحديد اللغات',
  stageComplete: 'اكتمل التحليل',
  progressFilesScanned: 'الملفات المفحوصة',
  progressLinesCounted: 'الأسطر المحسوبة',
  progressDownloaded: 'تم التحميل',
  progressCurrentFile: 'الملف الحالي',
  exportPdf: 'تصدير PDF',
  exportingPdf: 'جارٍ إنشاء PDF...',
  branchLabel: 'الفرع',
  starsLabel: 'النجوم',
  forksLabel: 'التفرعات',
  licenseLabel: 'الرخصة',
  kpiTotalLines: 'إجمالي أسطر الكود',
  kpiCodeLinesSub: '{code} سطر برمجي غير فارغ',
  kpiLanguages: 'اللغات المستخدمة',
  kpiPrimaryLangSub: 'الأساسية: {lang}',
  kpiAnalyzedFiles: 'الملفات البرمجية المحللة',
  kpiSkippedBinarySub: 'تم تخطي {skipped} ملف ثنائي',
  kpiTotalSize: 'حجم الشيفرة البرمجية',
  kpiDurationSub: 'تم التحليل خلال {seconds} ثانية',
  sectionLanguagesTitle: 'توزيع اللغات البرمجية',
  sectionLanguagesSubtitle:
    'توزيع الأسطر والملفات حسب امتداد الملف. اضغط على أي لغة أو عمود لتصفية مستكشف الملفات أدناه.',
  colLanguage: 'اللغة',
  colFiles: 'الملفات',
  colLines: 'إجمالي الأسطر',
  colCodeLines: 'أسطر الكود',
  colShare: 'النسبة',
  colSize: 'الحجم',
  allLanguagesOption: 'جميع اللغات',
  allExtensionsOption: 'جميع الامتدادات',
  sectionFilesTitle: 'مستكشف الملفات والبحث المتقدم',
  sectionFilesSubtitle:
    'ابحث في مسارات المستودع وصفِّ النتائج حسب اللغة، امتداد الملف، ونطاق الحجم بالكيلوبايت.',
  searchFilesPlaceholder: 'ابحث عن مسار أو اسم ملف (مثل src/ أو .apl)...',
  filterLanguageLabel: 'اللغة',
  filterExtensionLabel: 'نوع الملف',
  filterSizePresetLabel: 'نطاق الحجم',
  sizePresetAll: 'جميع الأحجام',
  sizePresetTiny: 'صغير جداً (< 1 KB)',
  sizePresetSmall: 'صغير (1 – 10 KB)',
  sizePresetMedium: 'متوسط (10 – 100 KB)',
  sizePresetLarge: 'كبير (> 100 KB)',
  minSizeKbLabel: 'أدنى KB',
  maxSizeKbLabel: 'أقصى KB',
  sortLabel: 'ترتيب حسب',
  sortLinesDesc: 'الأسطر (الأكثر أولاً)',
  sortLinesAsc: 'الأسطر (الأقل أولاً)',
  sortSizeDesc: 'الحجم (الأكبر أولاً)',
  sortSizeAsc: 'الحجم (الأصغر أولاً)',
  sortPathAsc: 'المسار (أ – ي)',
  resetFilters: 'إعادة ضبط',
  showingFilesSummary: 'عرض {shown} من أصل {total} ملف · {lines} سطر · {size}',
  colPath: 'مسار الملف',
  colExtension: 'الامتداد',
  noMatchingFiles: 'لا توجد ملفات مطابقة لمعايير البحث',
  noMatchingFilesHint: 'جرّب تعديل عبارة البحث أو نوع الملف أو حدود الحجم لعرض النتائج.',
  prevPage: 'السابق',
  nextPage: 'التالي',
  pageOf: 'صفحة {page} من {pages}',
  emptyStateTitle: 'جاهز لتحليل المستودع',
  emptyStateDesc:
    'أدخل رابط أي مستودع عام على GitHub بالأعلى لعدّ كل سطر برمجي، واستعراض تفصيل اللغات، وتصدير تقرير PDF متكامل.',
  featureAplTitle: 'كشف دقيق للغات ومنها APL',
  featureAplDesc:
    'يتعرف تلقائياً على أكثر من 100 امتداد برمجي، بما في ذلك لغة APL عبر ملفات .apl و .aplf و .apln و .dyalog.',
  featureFilterTitle: 'بحث وتصفية حسب النوع والحجم',
  featureFilterDesc:
    'تصفية فورية لآلاف الملفات حسب المسار، اللغة، الامتداد، ونطاق الحجم الدقيق بالكيلوبايت.',
  featurePdfTitle: 'تصدير التقرير بصيغة PDF',
  featurePdfDesc:
    'حمّل تقريراً منسقاً متعدد الصفحات بصيغة PDF يتضمن الإحصائيات وتفصيل اللغات والملفات باللغتين العربية والإنجليزية.',
  errorTitle: 'تعذر تحليل المستودع',
  errorInvalidUrl:
    'يرجى إدخال رابط مستودع GitHub عام صحيح (مثل https://github.com/owner/repo) أو owner/repo.',
  errorNotFound:
    'لم يتم العثور على المستودع أو الفرع. تأكد من صحة الرابط وأن المستودع عام.',
  errorRateLimit:
    'تم بلوغ حد طلبات GitHub المؤقت. يرجى الانتظار دقيقة ثم المحاولة مجدداً.',
  errorArchiveTooLarge:
    'حجم أرشيف المستودع يتجاوز الحد المسموح به للتحليل المباشر (250 ميجابايت).',
  errorGeneric: 'حدث خطأ غير متوقع أثناء تحليل المستودع.',
  truncatedNotice:
    'يتم عرض أهم 15,000 ملف في المستكشف التفاعلي؛ بينما تشمل الإحصائيات الإجمالية كامل المستودع.',
  pdfTitle: 'تقرير تحليل الشيفرة البرمجية للمستودع',
  pdfGeneratedOn: 'تاريخ التقرير',
  pdfTopFilesTitle: 'تفصيل الملفات المحللة',
  pdfFilterApplied: 'التصفية المطبقة',
  footerNote: 'CodeGauge · تحليلات الشيفرة البرمجية لمستودعات GitHub العامة',
  compareModeButton: 'مقارنة مع مستودع ثانٍ',
  closeCompareInput: 'إخفاء المستودع الثاني',
  secondRepoPlaceholder: 'رابط المستودع الثاني (مثل https://github.com/owner/repo-2)',
  addSecondRepoButton: 'مقارنة المستودعين',
  removeSecondRepo: 'إلغاء المقارنة',
  repoALabel: 'المستودع أ',
  repoBLabel: 'المستودع ب',
  comparisonSectionTitle: 'مقارنة المستودعين جنباً إلى جنب',
  comparisonSectionSubtitle:
    'مقارنة مباشرة لإجمالي أسطر الكود، عدد الملفات البرمجية، الحجم، وتوزيع اللغات.',
  comparisonMetricCol: 'المؤشر',
  comparisonDiffCol: 'الفرق (أ مقابل ب)',
  languageComparisonTitle: 'مقارنة توزيع اللغات البرمجية',
  languageComparisonSubtitle:
    'توزيع أسطر الكود لأبرز اللغات البرمجية في كلا المستودعين.',
  barChartTitle: 'أسطر الكود لكل لغة برمجية',
  barChartSubtitle: 'مقارنة أعلى اللغات من حيث إجمالي الأسطر وأسطر الكود غير الفارغة.',
  totalLinesLegend: 'إجمالي الأسطر',
  codeLinesLegend: 'أسطر الكود (غير الفارغة)',
  navComparison: 'المقارنة',
  comparingFileExplorerLabel: 'استعراض ملفات',
  pdfComparisonTitle: 'ملخص المقارنة بين المستودعين',
  errorSameRepo: 'يرجى إدخال رابط مستودع مختلف للمقارنة.',
  pwaInstallButton: 'تثبيت التطبيق',
  pwaInstallIosButton: 'التثبيت على iOS',
  pwaIosModalTitle: 'تثبيت CodeGauge على iPhone / iPad',
  pwaIosStep1: 'اضغط على زر المشاركة في شريط Safari.',
  pwaIosStep2: 'مرّر للأسفل واختر "إضافة إلى الشاشة الرئيسية".',
  pwaCloseModal: 'إغلاق',
  pwaOfflineBanner: 'وضع عدم الاتصال — الواجهة وآخر تقرير محفوظ متاحان',
  searchScopeFilename: 'اسم الملف',
  searchScopePath: 'المسار الكامل',
  searchFilenamePlaceholder: 'ابحث داخل أسماء الملفات (مثل App أو config أو .apl)...',
  clearSearchLabel: 'مسح البحث',
  activitySectionTitle: 'نشاط المستودع وتكرار الإيداعات',
  activitySectionSubtitle:
    'آخر وقت تحديث، عدد طلبات الدمج المفتوحة، ومعدل الإيداعات البرمجية على الفرع المحلل.',
  lastUpdatedLabel: 'آخر تحديث',
  openPrsLabel: 'طلبات الدمج المفتوحة',
  commitFrequencyLabel: 'معدل الإيداعات',
  commitsPerWeekUnit: '{count} / أسبوع',
  commitsLast30DaysSub: '{count} إيداع خلال آخر 30 يوماً',
  weeklyCommitsChartTitle: 'النشاط الأسبوعي للإيداعات (آخر 8 أسابيع)',
  weeklyTrendChartTitle: 'اتجاه النشاط الأسبوعي',
  weeklyTrendChartSubtitle: 'معدل الإيداعات خلال آخر 4 أسابيع',
  commitsUnitLabel: 'إيداع',
  fourWeekAvgLabel: 'متوسط 4 أسابيع: {count} / أسبوع',
  unavailableLabel: 'غير متاح',
  lastCommitLabel: 'أحدث إيداع',
  healthGaugeLabel: 'صحة الكود',
  healthRatingHealthy: 'جيدة',
  healthRatingModerate: 'متوسطة',
  healthRatingNeedsAttention: 'تحتاج مراجعة',
  healthPopoverTitle: 'تفاصيل مؤشر صحة الكود',
  healthCommentRatioLabel: 'نسبة التعليقات إلى الكود',
  healthCommentScoreLabel: 'نقاط التوثيق والتعليقات',
  healthFileSizeScoreLabel: 'توزيع أحجام الملفات',
  healthMedianSizeLabel: 'وسيط حجم الملف',
  healthOversizedFilesLabel: 'ملفات أكبر من 50 KB',
  healthNoCommentData: 'لا توجد ملفات برمجية تدعم التعليقات',
  healthRadarTitle: 'رادار مقارنة مؤشر صحة الكود',
  healthRadarSubtitle:
    'مقارنة معيارية من 0 إلى 100 للتوثيق، وتوزيع أحجام الملفات، وبساطة الكود، وكثافته.',
  radarAxisOverall: 'الصحة العامة',
  radarAxisComments: 'نسبة التعليقات',
  radarAxisFileSize: 'توزيع الأحجام',
  radarAxisComplexity: 'بساطة الكود',
  radarAxisDensity: 'كثافة الكود',
  radarLinesPerFileUnit: '{lines} سطر/ملف',
  shareButtonLabel: 'مشاركة',
  shareModalTitle: 'مشاركة تقرير المستودع',
  shareModalSubtitle:
    'انسخ رابط التقرير المباشر، أو حمّل بطاقة الملخص كصورة، أو شارك عبر المنصات الاجتماعية.',
  shareLinkLabel: 'رابط التقرير القابل للمشاركة',
  shareCopyLinkButton: 'نسخ الرابط',
  shareCopiedLabel: 'تم النسخ',
  shareCardPreviewLabel: 'صورة بطاقة الملخص',
  shareDownloadImageButton: 'تحميل PNG',
  shareCopyImageButton: 'نسخ الصورة',
  shareSocialPlatformsLabel: 'مشاركة عبر منصات التواصل',
  shareTwitterLabel: 'X / تويتر',
  shareLinkedInLabel: 'لينكدإن',
  shareFacebookLabel: 'فيسبوك',
  radarModePercentage: 'النسب المئوية (%)',
  radarModeRawLines: 'عدد الأسطر الفعلي',
  radarAxisBlankLines: 'الأسطر الفارغة',
  radarAxisCommentLines: 'أسطر التعليقات',
  radarAxisPrimaryLangLines: 'اللغة الأساسية',
  pdfIncludeDetailedBreakdown: 'تضمين التفصيل الموسع (أكبر 10)',
  pdfDetailedBreakdownTitle: 'التفصيل الموسع — أكبر 10 ملفات من حيث عدد الأسطر',
  pdfRankCol: '#',
  langGrowthTitle: 'نمو أعلى 5 لغات برمجية',
  langGrowthSubtitle:
    'مقارنة توزيع اللغات الحالي مع اللقطة التاريخية قبل شهر واحد ({date}).',
  langGrowthLegendPrevious: 'قبل شهر',
  langGrowthLegendCurrent: 'الحالي',
  langGrowthMetricLines: 'أسطر الكود',
  langGrowthMetricShare: 'النسبة (%)',
  langGrowthNoChange: 'دون تغيير',
  heatmapSectionTitle: 'خريطة حرارية لحجم الملفات وتعقيدها',
  heatmapSectionSubtitle:
    'توضح الملفات الأكبر حجماً (بالبايت) أو الأكثر تعقيداً (بعدّ الأسطر) مقارنةً بين المستودعين.',
  heatmapModeAll: 'جميع المؤشرات',
  heatmapModeSize: 'الحجم (بايت)',
  heatmapModeComplexity: 'التعقيد (الأسطر)',
  heatmapLegendLow: 'منخفض',
  heatmapLegendModerate: 'متوسط',
  heatmapLegendHigh: 'مرتفع',
  heatmapLegendHotspot: 'بؤرة تركيز (≥1.5×)',
  heatmapRankCol: '#',
  heatmapLargerTag: '{ratio}× حجم',
  heatmapComplexTag: '{ratio}× أسطر',
  navComplexity: 'التعقيد',
  healthComplexityScoreLabel: 'التعقيد السيكلوماتي',
  healthComplexityAvgSub: 'المتوسط M = {avg} عبر {files} ملفاً برمجياً',
  complexitySectionTitle: 'التعقيد السيكلوماتي وتوصيات إعادة الهيكلة',
  complexitySectionSubtitle:
    'تحليل البنية البرمجية وتفرعات التدفق لتحديد الملفات الأعلى تعقيداً واقتراح خطوات عملية لإعادة الهيكلة.',
  complexityScoreLabel: 'مؤشر صحة التعقيد',
  complexityAvgLabel: 'متوسط تعقيد الملف',
  complexityAvgSub: 'عبر {files} ملفاً برمجياً · متوسط العمق {depth}',
  complexityPeakLabel: 'أعلى تعقيد لملف',
  complexityPeakSub: 'أعلى عدد مسارات تفرع في ملف واحد',
  complexityFlaggedLabel: 'ملفات مرشحة للتحسين',
  complexityFlaggedSub: 'ملفات ذات تعقيد ≥ 15 أو تداخل عميق',
  complexityTierLow: 'تعقيد منخفض',
  complexityTierModerate: 'تعقيد متوسط',
  complexityTierHigh: 'تعقيد مرتفع',
  complexityFilterAll: 'جميع الملفات المرصودة',
  complexityFilterCriticalHigh: 'حرج ومرتفع',
  complexityFilterNesting: 'تداخل عميق',
  complexityFilterLarge: 'ملفات ضخمة',
  complexityMetricValue: 'M = {value}',
  complexityDepthLabel: 'عمق {depth}',
  complexityFunctionsLabel: '{count} دوال',
  complexitySeverityCritical: 'حرج',
  complexitySeverityHigh: 'مرتفع',
  complexitySeverityModerate: 'متوسط',
  recTitleExtractFunctions: 'استخلاص دوال مساعدة',
  recDescExtractFunctions:
    'ارتفاع كثافة التفرعات مقارنة بعدد الدوال يشير إلى دوال متضخمة؛ افصل الأجزاء المترابطة إلى دوال صغيرة محددة المسؤولية.',
  recTitleFlattenNesting: 'تقليل التداخل الشرطي',
  recDescFlattenNesting:
    'تصل الكتل البرمجية إلى {depth} مستويات من التداخل؛ استخدم الإرجاع المبكر وشروط الحماية لتسطيح المسار.',
  recTitleSimplifyConditionals: 'تبسيط منطق التفرعات',
  recDescSimplifyConditionals:
    'شجرة القرارات الكثيفة (M = {complexity}) تزيد احتمالية الأخطاء؛ استبدل سلاسل الشروط الطويلة بجداول بحث أو نمط الاستراتيجية.',
  recTitleSplitModule: 'تقسيم الوحدة البرمجية',
  recDescSplitModule:
    'حجم الملف الكبير ({lines} سطر كود) يجمع عدة مسؤوليات؛ قسّمه إلى وحدات أصغر متخصصة.',
  recTitleAddDocumentation: 'توثيق المسارات المعقدة',
  recDescAddDocumentation:
    'نسبة التعليقات منخفضة مقارنة بتعقيد التدفق؛ أضف توضيحاً للشروط الحدية والقواعد قبل إعادة الهيكلة.',
  complexityCleanTitle: 'بنية برمجية متوازنة',
  complexityCleanDesc:
    'جميع الملفات البرمجية المحللة تقع ضمن حدود التعقيد الآمنة (M < 15) وبمستوى تداخل متوازن.',
  complexityNoMatchFilter: 'لا توجد ملفات مطابقة لتصفية التعقيد المحددة.',
  kpiTooltipTotalLines:
    'إجمالي عدد الأسطر (أسطر الكود غير الفارغة + الأسطر الفارغة) عبر جميع الملفات النصية والبرمجية المحللة، باستثناء الملفات الثنائية وما يتجاوز 5 ميجابايت.',
  kpiTooltipLanguages:
    'عدد لغات البرمجة والتنسيق والتكوين المميزة المكتشفة عبر امتدادات الملفات وأسمائها الخاصة (بما فيها APL عبر .apl).',
  kpiTooltipAnalyzedFiles:
    'إجمالي الملفات النصية والبرمجية التي تم فحصها وعدّ أسطرها من أرشيف المستودع؛ يتم تخطي الملفات الثنائية وما يتجاوز 5 ميجابايت تلقائياً.',
  kpiTooltipTotalSize:
    'مجموع الأحجام غير المضغوطة بالبايت لجميع الملفات البرمجية المحللة مع مدة التحميل والتحليل على الخادم.',
  kpiTooltipComplexityScore:
    'مؤشر صحة من 0 إلى 100 (100 = الأبسط) يتأثر بمتوسط التعقيد السيكلوماتي، نسبة الملفات المعقدة، عمق التداخل، وأعلى تعقيد لملف.',
  kpiTooltipComplexityAvg:
    'متوسط التعقيد السيكلوماتي (M) لكل ملف برمجي؛ يبدأ من 1 ويزداد مع كل تفرع تدفق (الشروط، الحلقات، switch/case، &&، ||، وحراس APL).',
  kpiTooltipComplexityPeak:
    'أعلى قيمة تعقيد سيكلوماتي (M) تم رصدها في ملف برمجي واحد داخل المستودع.',
  kpiTooltipComplexityFlagged:
    'عدد الملفات المرشحة لإعادة الهيكلة بسبب M ≥ 15، أو تداخل عميق (≥ 5 مع أكثر من 100 سطر)، أو حجم متضخم (≥ 450 سطراً مع M ≥ 10).',
  kpiTooltipLastUpdated:
    'أحدث طابع زمني للدفع البرمجي أو التحديث مسجل للمستودع عبر واجهة GitHub.',
  kpiTooltipOpenPrs:
    'العدد الفعلي لطلبات الدمج المفتوحة حالياً والمجلب من واجهة برمجة تطبيقات GitHub.',
  kpiTooltipCommitFrequency:
    'متوسط الإيداعات الأسبوعي وإجمالي الإيداعات خلال آخر 30 يوماً استناداً إلى عينة تصل إلى أحدث 100 إيداع على الفرع المحلل.',
  hotspotTreemapTitle: 'خريطة الكثافة والبؤر الساخنة للمجلدات (Treemap)',
  hotspotTreemapSubtitle:
    'تمثل مساحة المستطيل كثافة أسطر الكود ويمثل اللون درجة التعقيد السيكلوماتي. اضغط على أي مجلد للتكبير أو على ملف لمعاينته.',
  hotspotRootLabel: 'الجذر',
  hotspotZoomOutButton: 'مستوى للأعلى',
  hotspotLegendLow: 'منخفض (M < 10)',
  hotspotLegendModerate: 'متوسط (10–19)',
  hotspotLegendElevated: 'مرتفع (20–34)',
  hotspotLegendCritical: 'بؤرة ساخنة (M ≥ 35)',
  hotspotLegendData: 'إعدادات / توثيق',
  hotspotClickFolderHint: 'اضغط على المجلد للتعمق في ملفاته',
  hotspotClickFileHint: 'اضغط على الملف لعرض تفاصيل التعقيد',
  hotspotOtherSmallItems: '{count} عناصر أصغر',
  hotspotFolderSummary: '{files} ملفاً · متوسط M = {avg} · أعلى M = {peak}',
  hotspotSelectedFileTitle: 'تفاصيل الملف المحدد',
  hotspotOpenInExplorer: 'تصفية في مستكشف الملفات',
  hotspotEmptyDir: 'لا توجد ملفات برمجية غير فارغة داخل هذا المجلد.',
  adoptionTrendTitle: 'اتجاه تبنّي اللغات البرمجية (آخر 12 شهراً)',
  adoptionTrendSubtitle:
    'يتتبع تواريخ إنشاء الملفات وحجم الاستخدام الشهري لأبرز 5 لغات برمجية على مدار العام الماضي.',
  adoptionIncreasingLabel: 'في ازدياد',
  adoptionDecreasingLabel: 'في تراجع',
  adoptionStableLabel: 'مستقر',
  adoptionNewFilesMonth: '+{count} ملف جديد',
  adoptionCreated12m: '{count} ملفات أُنشئت خلال 12 شهراً',
  adoptionNoChangeLabel: 'دون تغيير',
  fileTypeSummaryTitle: 'مقارنة توزيع أنواع الملفات',
  fileTypeSummarySubtitle:
    'تقارن نسبة الشيفرة المصدرية والاختبارات والتوثيق وملفات التكوين والتنسيق بين المستودعين.',
  fileTypeMetricShare: 'النسبة (%)',
  fileTypeMetricLines: 'أسطر الكود',
  fileTypeMetricFiles: 'عدد الملفات',
  fileCategorySource: 'الشيفرة المصدرية',
  fileCategoryTests: 'الاختبارات',
  fileCategoryDocs: 'التوثيق',
  fileCategoryConfig: 'التكوين والبناء',
  fileCategoryOther: 'التنسيق وأخرى',
  fileCategoryCol: 'فئة الملف',
};

export const DICTIONARY: Record<AppLanguage, Translations> = {
  en: EN,
  ar: AR,
};

export function formatMessage(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    values[key] !== undefined ? String(values[key]) : `{${key}}`
  );
}

export function formatNumber(num: number, lang: AppLanguage): string {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US').format(num);
}
