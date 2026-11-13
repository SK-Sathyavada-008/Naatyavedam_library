import React from 'react';
import type { FuseResult } from 'fuse.js';
import type { Song } from '../../types/index.ts';

export interface HighlightedTextProps {
  text: string;
  fieldKey: string;
  matches?: FuseResult<Song>['matches'];
  className?: string;
  highlightClassName?: string;
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  fieldKey,
  matches,
  className = '',
  highlightClassName = 'bg-sage-light text-sage-hover font-semibold px-0.5 rounded',
}) => {
  if (!matches || matches.length === 0 || !text) {
    return <span className={className}>{text}</span>;
  }

  const match = matches.find((m) => m.key === fieldKey);
  if (!match || !match.indices || match.indices.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Merge overlapping or adjacent indices
  const sorted = [...match.indices].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];

  for (const [start, end] of sorted) {
    if (merged.length === 0) {
      merged.push([start, end]);
    } else {
      const prev = merged[merged.length - 1];
      if (start <= prev[1] + 1) {
        prev[1] = Math.max(prev[1], end);
      } else {
        merged.push([start, end]);
      }
    }
  }

  // Build segments
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  merged.forEach(([start, end], i) => {
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    nodes.push(
      <mark key={i} className={highlightClassName}>
        {text.slice(start, end + 1)}
      </mark>
    );
    lastIndex = end + 1;
  });

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return <span className={className}>{nodes}</span>;
};
