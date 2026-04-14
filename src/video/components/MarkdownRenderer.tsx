import ReactMarkdown, {type Components} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {styles} from '../styles';

export const markdownComponents: Components = {
  h1: ({children}) => <h1 style={styles.h1}>{children}</h1>,
  h2: ({children}) => <h2 style={styles.h2}>{children}</h2>,
  h3: ({children}) => <h3 style={styles.h3}>{children}</h3>,
  p: ({children}) => <p style={styles.paragraph}>{children}</p>,
  ul: ({children}) => <ul style={styles.list}>{children}</ul>,
  ol: ({children}) => <ol style={styles.list}>{children}</ol>,
  li: ({children}) => <li style={styles.listItem}>{children}</li>,
  blockquote: ({children}) => <blockquote style={styles.blockquote}>{children}</blockquote>,
  code: ({children, className}) => {
    const isInline = !className;
    return isInline ? (
      <code style={styles.inlineCode}>{children}</code>
    ) : (
      <pre style={styles.preformatted}>
        <code>{children}</code>
      </pre>
    );
  },
  strong: ({children}) => <strong style={styles.strong}>{children}</strong>,
  table: ({children}) => (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>{children}</table>
    </div>
  ),
  thead: ({children}) => <thead style={styles.thead}>{children}</thead>,
  tbody: ({children}) => <tbody>{children}</tbody>,
  tr: ({children}) => <tr style={styles.tr}>{children}</tr>,
  th: ({children}) => <th style={styles.th}>{children}</th>,
  td: ({children}) => <td style={styles.td}>{children}</td>,
};

export {ReactMarkdown, remarkGfm};
