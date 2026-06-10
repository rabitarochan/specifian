/**
 * ステータスを色付きのピル型バッジで表示するサンプルコンポーネント。
 *
 * specs/_components/ に置いたファイルは、全 MDX から import 不要で使えます。
 * ファイル名 (PascalCase) または named export 名がコンポーネント名になります。
 *
 * 注意: _components 内のファイルは 'react' 以外を import できません。
 *       CSS も import できないため、スタイルはインライン (style 属性) で記述します。
 */
import * as React from 'react';

interface StatusBadgeProps {
  status: string;
}

const COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: '#e5e7eb', fg: '#374151' }, // gray
  published: { bg: '#dcfce7', fg: '#166534' }, // green
  deprecated: { bg: '#fee2e2', fg: '#991b1b' }, // red
};

const DEFAULT_COLOR = { bg: '#dbeafe', fg: '#1e40af' }; // blue

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = COLORS[status] ?? DEFAULT_COLOR;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '0.8125rem',
        fontWeight: 600,
        lineHeight: 1.5,
        backgroundColor: color.bg,
        color: color.fg,
      }}
    >
      {status}
    </span>
  );
}
