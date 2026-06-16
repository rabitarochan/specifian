/** CodeMirror wrapper (markdown language, full height). */
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { useMemo } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function Editor({ value, onChange }: Props) {
  const extensions = useMemo(() => [markdown()], []);
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      height="100%"
      className="sb-editor"
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        foldGutter: false,
      }}
    />
  );
}
