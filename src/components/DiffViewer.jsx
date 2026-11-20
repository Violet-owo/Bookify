import React from 'react';
import { useI18n } from '../utils/i18n';

/**
 * Computes a simple word-level diff between original and modified strings.
 * Returns an array of tokens: { type: 'equal' | 'removed' | 'added', text: string }
 */
export function computeWordDiff(original = '', modified = '') {
  const origTokens = original.split(/(\s+|[.,!?;:«»"'—–()]+)/).filter(Boolean);
  const modTokens = modified.split(/(\s+|[.,!?;:«»"'—–()]+)/).filter(Boolean);

  const n = origTokens.length;
  const m = modTokens.length;

  // Use dynamic programming LCS for accurate word-level diff
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (origTokens[i] === modTokens[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack
  let i = n;
  let j = m;
  const diff = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origTokens[i - 1] === modTokens[j - 1]) {
      diff.unshift({ type: 'equal', text: origTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'added', text: modTokens[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: 'removed', text: origTokens[i - 1] });
      i--;
    }
  }

  return diff;
}

/**
 * Visual diff viewer component displaying highlighted changes
 */
export default function DiffViewer({ original, modified, className = '' }) {
  const { t } = useI18n();
  const diff = React.useMemo(() => computeWordDiff(original, modified), [original, modified]);

  const hasChanges = diff.some(d => d.type !== 'equal');

  if (!hasChanges) {
    return (
      <div 
        className={className} 
        style={{ 
          padding: '0.75rem', 
          borderRadius: 'var(--radius-sm)', 
          background: 'var(--bg-primary)', 
          color: 'var(--text-secondary)',
          fontSize: '0.82rem',
          lineHeight: 1.6,
          border: '1px dashed var(--border-subtle)'
        }}
      >
        <span>{t('diff.noChanges')}</span>
      </div>
    );
  }

  return (
    <div 
      className={`diff-viewer ${className}`}
      style={{
        padding: '0.85rem 1rem',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-subtle)',
        fontSize: '0.85rem',
        lineHeight: 1.65,
        maxHeight: '180px',
        overflowY: 'auto',
        fontFamily: 'var(--font-serif)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}
    >
      {diff.map((part, index) => {
        if (part.type === 'removed') {
          return (
            <mark
              key={index}
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent-coral) 20%, transparent)',
                color: 'var(--accent-coral)',
                textDecoration: 'line-through',
                padding: '0.08rem 0.25rem',
                borderRadius: '3px',
                margin: '0 1px'
              }}
              title={t('diff.removed')}
            >
              {part.text}
            </mark>
          );
        }
        if (part.type === 'added') {
          return (
            <mark
              key={index}
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent-green) 22%, transparent)',
                color: 'var(--accent-green)',
                fontWeight: '600',
                padding: '0.08rem 0.25rem',
                borderRadius: '3px',
                margin: '0 1px'
              }}
              title={t('diff.added')}
            >
              {part.text}
            </mark>
          );
        }
        return <span key={index} style={{ color: 'var(--text-primary)' }}>{part.text}</span>;
      })}
    </div>
  );
}
