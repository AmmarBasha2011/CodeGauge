import type { FileFilterState } from './FileExplorer.tsx';
import { formatMessage, formatNumber, type Translations } from '../lib/i18n.ts';
import { formatBytes } from '../lib/languageMap.ts';
import type { AnalysisResult, AnalyzedFile, AppLanguage } from '../lib/types.ts';

interface PdfReportSheetProps {
  t: Translations;
  lang: AppLanguage;
  result: AnalysisResult;
  compareResult?: AnalysisResult | null;
  filteredFiles: AnalyzedFile[];
  filters: FileFilterState;
  includeDetailedBreakdown?: boolean;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function PdfReportSheet({
  t,
  lang,
  result,
  compareResult,
  filteredFiles,
  filters,
  includeDetailedBreakdown = true,
}: PdfReportSheetProps) {
  const isRtl = lang === 'ar';
  const { repository, summary, languages } = result;

  const languageChunks = chunkArray(languages, 22);
  const topLargestFiles = includeDetailedBreakdown
    ? [...result.files]
        .sort((a, b) => b.lines - a.lines || b.sizeBytes - a.sizeBytes)
        .slice(0, 10)
    : [];
  const topFiles = filteredFiles.slice(0, 75);
  const fileChunks = chunkArray(topFiles, 25);

  const generatedDate = new Intl.DateTimeFormat(
    lang === 'ar' ? 'ar-EG' : 'en-US',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  ).format(new Date());

  const activeFilterParts: string[] = [];
  if (filters.query) activeFilterParts.push(`"${filters.query}"`);
  if (filters.language !== 'ALL') activeFilterParts.push(filters.language);
  if (filters.extension !== 'ALL') activeFilterParts.push(filters.extension);
  if (filters.sizePreset !== 'all') activeFilterParts.push(filters.sizePreset);
  if (filters.minKb) activeFilterParts.push(`>= ${filters.minKb} KB`);
  if (filters.maxKb) activeFilterParts.push(`<= ${filters.maxKb} KB`);

  return (
    <div
      id="pdf-report-root"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        left: '-12000px',
        top: 0,
        width: '794px',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        fontFamily:
          '"Plus Jakarta Sans", "IBM Plex Sans Arabic", system-ui, sans-serif',
        padding: '0',
        zIndex: -1,
      }}
    >
      {/* Block 1: Header + Repository Overview + KPIs + Stacked Bar */}
      <div
        className="pdf-block"
        style={{
          padding: '32px 36px 20px 36px',
          backgroundColor: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #0f172a',
            paddingBottom: '16px',
            gap: '16px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#0284c7',
                marginBottom: '4px',
              }}
            >
              {t.brand}
            </div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: '#0f172a',
                margin: 0,
              }}
            >
              {t.pdfTitle}
            </h1>
            <div
              dir="ltr"
              style={{
                marginTop: '6px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#334155',
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              {repository.fullName}
              {compareResult ? ` vs ${compareResult.repository.fullName}` : ''}
            </div>
          </div>
          <div style={{ textAlign: isRtl ? 'left' : 'right', fontSize: '11px', color: '#475569' }}>
            <div>{t.pdfGeneratedOn}</div>
            <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
              {generatedDate}
            </div>
            <div style={{ marginTop: '4px' }}>
              {t.branchLabel}: <strong dir="ltr">{repository.defaultBranch}</strong>
            </div>
            {typeof repository.openPullRequests === 'number' && (
              <div style={{ marginTop: '2px' }}>
                {t.openPrsLabel}:{' '}
                <strong>{formatNumber(repository.openPullRequests, lang)}</strong>
              </div>
            )}
          </div>
        </div>

        {repository.description && (
          <p
            style={{
              marginTop: '12px',
              marginBottom: 0,
              fontSize: '12px',
              color: '#475569',
              lineHeight: 1.5,
            }}
          >
            {repository.description}
          </p>
        )}

        {/* KPI Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginTop: '18px',
          }}
        >
          {[
            {
              label: t.kpiTotalLines,
              value: formatNumber(summary.totalLines, lang),
              sub: formatMessage(t.kpiCodeLinesSub, {
                code: formatNumber(summary.codeLines, lang),
              }),
            },
            {
              label: t.kpiLanguages,
              value: formatNumber(summary.languageCount, lang),
              sub: formatMessage(t.kpiPrimaryLangSub, {
                lang: languages[0]?.name ?? '-',
              }),
            },
            {
              label: t.kpiAnalyzedFiles,
              value: formatNumber(summary.analyzedFiles, lang),
              sub: formatMessage(t.kpiSkippedBinarySub, {
                skipped: formatNumber(summary.skippedBinaryFiles, lang),
              }),
            },
            {
              label: t.kpiTotalSize,
              value: formatBytes(summary.totalSizeBytes),
              sub: `${t.starsLabel}: ${formatNumber(repository.stars, lang)}`,
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '12px',
                backgroundColor: '#f8fafc',
              }}
            >
              <div style={{ fontSize: '11px', color: '#475569' }}>{kpi.label}</div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#0f172a',
                  marginTop: '4px',
                  fontFamily: '"JetBrains Mono", monospace',
                }}
              >
                {kpi.value}
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>
                {kpi.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Comparison Summary Block inside PDF when comparing two repos */}
        {compareResult && (
          <div style={{ marginTop: '18px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#0f172a',
                marginBottom: '6px',
              }}
            >
              {t.pdfComparisonTitle}
            </div>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '10px',
                border: '1px solid #cbd5e1',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '6px 8px', textAlign: isRtl ? 'right' : 'left' }}>
                    {t.comparisonMetricCol}
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: isRtl ? 'left' : 'right', fontFamily: '"JetBrains Mono", monospace' }}>
                    {repository.fullName}
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: isRtl ? 'left' : 'right', fontFamily: '"JetBrains Mono", monospace' }}>
                    {compareResult.repository.fullName}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px' }}>{t.kpiTotalLines}</td>
                  <td style={{ padding: '6px 8px', textAlign: isRtl ? 'left' : 'right', fontFamily: '"JetBrains Mono", monospace' }}>
                    {formatNumber(summary.totalLines, lang)}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: isRtl ? 'left' : 'right', fontFamily: '"JetBrains Mono", monospace' }}>
                    {formatNumber(compareResult.summary.totalLines, lang)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px' }}>{t.colCodeLines}</td>
                  <td style={{ padding: '6px 8px', textAlign: isRtl ? 'left' : 'right', fontFamily: '"JetBrains Mono", monospace' }}>
                    {formatNumber(summary.codeLines, lang)}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: isRtl ? 'left' : 'right', fontFamily: '"JetBrains Mono", monospace' }}>
                    {formatNumber(compareResult.summary.codeLines, lang)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px' }}>{t.kpiLanguages}</td>
                  <td style={{ padding: '6px 8px', textAlign: isRtl ? 'left' : 'right', fontFamily: '"JetBrains Mono", monospace' }}>
                    {formatNumber(summary.languageCount, lang)}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: isRtl ? 'left' : 'right', fontFamily: '"JetBrains Mono", monospace' }}>
                    {formatNumber(compareResult.summary.languageCount, lang)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 8px' }}>{t.kpiTotalSize}</td>
                  <td style={{ padding: '6px 8px', textAlign: isRtl ? 'left' : 'right', fontFamily: '"JetBrains Mono", monospace' }}>
                    {formatBytes(summary.totalSizeBytes)}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: isRtl ? 'left' : 'right', fontFamily: '"JetBrains Mono", monospace' }}>
                    {formatBytes(compareResult.summary.totalSizeBytes)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Stacked language bar */}
        {summary.totalLines > 0 && (
          <div style={{ marginTop: '18px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#0f172a',
                marginBottom: '6px',
              }}
            >
              {t.sectionLanguagesTitle}
            </div>
            <div
              style={{
                display: 'flex',
                height: '10px',
                width: '100%',
                borderRadius: '999px',
                overflow: 'hidden',
                backgroundColor: '#e2e8f0',
              }}
            >
              {languages.map((item) => {
                const w = (item.lines / summary.totalLines) * 100;
                if (w < 0.25) return null;
                return (
                  <div
                    key={item.name}
                    style={{
                      width: `${w}%`,
                      height: '100%',
                      backgroundColor: item.color,
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Block 2+: Language Breakdown Table Chunks */}
      {languageChunks.map((chunk, chunkIdx) => (
        <div
          key={`lang-chunk-${chunkIdx}`}
          className="pdf-block"
          style={{
            padding: '12px 36px 20px 36px',
            backgroundColor: '#ffffff',
          }}
        >
          {chunkIdx > 0 && (
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '8px',
              }}
            >
              {t.sectionLanguagesTitle} ({chunkIdx + 1})
            </div>
          )}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '11px',
              border: '1px solid #cbd5e1',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '8px 10px', textAlign: isRtl ? 'right' : 'left', fontWeight: 600 }}>
                  {t.colLanguage}
                </th>
                <th style={{ padding: '8px 10px', textAlign: isRtl ? 'left' : 'right', fontWeight: 600 }}>
                  {t.colFiles}
                </th>
                <th style={{ padding: '8px 10px', textAlign: isRtl ? 'left' : 'right', fontWeight: 600 }}>
                  {t.colLines}
                </th>
                <th style={{ padding: '8px 10px', textAlign: isRtl ? 'left' : 'right', fontWeight: 600 }}>
                  {t.colCodeLines}
                </th>
                <th style={{ padding: '8px 10px', textAlign: isRtl ? 'left' : 'right', fontWeight: 600 }}>
                  {t.colShare}
                </th>
                <th style={{ padding: '8px 10px', textAlign: isRtl ? 'left' : 'right', fontWeight: 600 }}>
                  {t.colSize}
                </th>
              </tr>
            </thead>
            <tbody>
              {chunk.map((item) => (
                <tr key={item.name} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '7px 10px', fontWeight: 500 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '2px',
                        backgroundColor: item.color,
                        marginInlineEnd: '8px',
                      }}
                    />
                    {item.name}
                  </td>
                  <td
                    style={{
                      padding: '7px 10px',
                      textAlign: isRtl ? 'left' : 'right',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {formatNumber(item.files, lang)}
                  </td>
                  <td
                    style={{
                      padding: '7px 10px',
                      textAlign: isRtl ? 'left' : 'right',
                      fontWeight: 600,
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {formatNumber(item.lines, lang)}
                  </td>
                  <td
                    style={{
                      padding: '7px 10px',
                      textAlign: isRtl ? 'left' : 'right',
                      color: '#475569',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {formatNumber(item.codeLines, lang)}
                  </td>
                  <td
                    style={{
                      padding: '7px 10px',
                      textAlign: isRtl ? 'left' : 'right',
                      color: '#0284c7',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {item.percentage.toFixed(1)}%
                  </td>
                  <td
                    style={{
                      padding: '7px 10px',
                      textAlign: isRtl ? 'left' : 'right',
                      color: '#475569',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {formatBytes(item.sizeBytes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Optional Detailed Breakdown: Top 10 Largest Files by Lines of Code */}
      {includeDetailedBreakdown && topLargestFiles.length > 0 && (
        <div
          className="pdf-block"
          style={{
            padding: '14px 36px 20px 36px',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              {t.pdfDetailedBreakdownTitle}
            </div>
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '10px',
              border: '1px solid #cbd5e1',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 600, width: '32px' }}>
                  {t.pdfRankCol}
                </th>
                <th style={{ padding: '7px 8px', textAlign: isRtl ? 'right' : 'left', fontWeight: 600 }}>
                  {t.colPath}
                </th>
                <th style={{ padding: '7px 8px', textAlign: isRtl ? 'right' : 'left', fontWeight: 600 }}>
                  {t.colLanguage}
                </th>
                <th style={{ padding: '7px 8px', textAlign: isRtl ? 'left' : 'right', fontWeight: 600 }}>
                  {t.colLines}
                </th>
                <th style={{ padding: '7px 8px', textAlign: isRtl ? 'left' : 'right', fontWeight: 600 }}>
                  {t.colCodeLines}
                </th>
                <th style={{ padding: '7px 8px', textAlign: isRtl ? 'left' : 'right', fontWeight: 600 }}>
                  {t.colShare}
                </th>
                <th style={{ padding: '7px 8px', textAlign: isRtl ? 'left' : 'right', fontWeight: 600 }}>
                  {t.colSize}
                </th>
              </tr>
            </thead>
            <tbody>
              {topLargestFiles.map((file, idx) => {
                const sharePct =
                  summary.totalLines > 0
                    ? ((file.lines / summary.totalLines) * 100).toFixed(1)
                    : '0.0';
                return (
                  <tr key={`top10-${file.path}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: 'center',
                        fontWeight: 600,
                        color: '#475569',
                        fontFamily: '"JetBrains Mono", monospace',
                      }}
                    >
                      {formatNumber(idx + 1, lang)}
                    </td>
                    <td
                      dir="ltr"
                      style={{
                        padding: '6px 8px',
                        fontFamily: '"JetBrains Mono", monospace',
                        color: '#0f172a',
                        maxWidth: '300px',
                        wordBreak: 'break-all',
                      }}
                    >
                      {file.path}
                    </td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: '7px',
                          height: '7px',
                          borderRadius: '2px',
                          backgroundColor: file.color,
                          marginInlineEnd: '6px',
                        }}
                      />
                      {file.language}
                    </td>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: isRtl ? 'left' : 'right',
                        fontWeight: 700,
                        fontFamily: '"JetBrains Mono", monospace',
                      }}
                    >
                      {formatNumber(file.lines, lang)}
                    </td>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: isRtl ? 'left' : 'right',
                        color: '#475569',
                        fontFamily: '"JetBrains Mono", monospace',
                      }}
                    >
                      {formatNumber(file.codeLines, lang)}
                    </td>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: isRtl ? 'left' : 'right',
                        color: '#0284c7',
                        fontFamily: '"JetBrains Mono", monospace',
                      }}
                    >
                      {sharePct}%
                    </td>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: isRtl ? 'left' : 'right',
                        color: '#475569',
                        fontFamily: '"JetBrains Mono", monospace',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatBytes(file.sizeBytes)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Block 3+: Files Breakdown Chunks */}
      {fileChunks.map((chunk, chunkIdx) => (
        <div
          key={`file-chunk-${chunkIdx}`}
          className="pdf-block"
          style={{
            padding: '14px 36px 24px 36px',
            backgroundColor: '#ffffff',
          }}
        >
          {chunkIdx === 0 ? (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                {t.pdfTopFilesTitle} ({formatNumber(topFiles.length, lang)} / {formatNumber(filteredFiles.length, lang)})
              </div>
              {activeFilterParts.length > 0 && (
                <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
                  {t.pdfFilterApplied}: {activeFilterParts.join(' · ')}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '8px',
              }}
            >
              {t.pdfTopFilesTitle} ({chunkIdx + 1})
            </div>
          )}

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '10px',
              border: '1px solid #cbd5e1',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '7px 8px', textAlign: isRtl ? 'right' : 'left', fontWeight: 600 }}>
                  {t.colPath}
                </th>
                <th style={{ padding: '7px 8px', textAlign: isRtl ? 'right' : 'left', fontWeight: 600 }}>
                  {t.colLanguage}
                </th>
                <th style={{ padding: '7px 8px', textAlign: isRtl ? 'left' : 'right', fontWeight: 600 }}>
                  {t.colLines}
                </th>
                <th style={{ padding: '7px 8px', textAlign: isRtl ? 'left' : 'right', fontWeight: 600 }}>
                  {t.colSize}
                </th>
              </tr>
            </thead>
            <tbody>
              {chunk.map((file) => (
                <tr key={file.path} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td
                    dir="ltr"
                    style={{
                      padding: '6px 8px',
                      fontFamily: '"JetBrains Mono", monospace',
                      color: '#0f172a',
                      maxWidth: '410px',
                      wordBreak: 'break-all',
                    }}
                  >
                    {file.path}
                  </td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                    {file.language}
                  </td>
                  <td
                    style={{
                      padding: '6px 8px',
                      textAlign: isRtl ? 'left' : 'right',
                      fontWeight: 600,
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {formatNumber(file.lines, lang)}
                  </td>
                  <td
                    style={{
                      padding: '6px 8px',
                      textAlign: isRtl ? 'left' : 'right',
                      color: '#475569',
                      fontFamily: '"JetBrains Mono", monospace',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatBytes(file.sizeBytes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
