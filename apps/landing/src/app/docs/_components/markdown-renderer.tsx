import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

function slugify(text: string) {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractText((children as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

const components: Components = {
  h1: ({ children }) => {
    const text = extractText(children);
    const id = slugify(text);
    return (
      <h1
        id={id}
        className="text-foreground mb-2 text-4xl leading-tight font-black tracking-tighter md:text-[2.5rem]"
      >
        {children}
      </h1>
    );
  },

  h2: ({ children }) => {
    const text = extractText(children);
    const id = slugify(text);
    return (
      <h2
        id={id}
        className="group text-foreground mt-14 mb-4 flex scroll-mt-24 items-center gap-2 text-2xl font-bold tracking-tight"
      >
        <a
          href={`#${id}`}
          className="text-muted-foreground hover:text-brand-orange text-lg opacity-0 transition-all group-hover:opacity-100"
          aria-hidden
        >
          #
        </a>
        {children}
      </h2>
    );
  },

  h3: ({ children }) => {
    const text = extractText(children);
    const id = slugify(text);
    return (
      <h3
        id={id}
        className="text-foreground/90 mt-8 mb-3 scroll-mt-24 text-lg font-bold tracking-tight"
      >
        {children}
      </h3>
    );
  },

  h4: ({ children }) => (
    <h4 className="text-foreground/80 mt-6 mb-2 text-base font-bold">{children}</h4>
  ),

  p: ({ children }) => <p className="text-muted-foreground mb-4 leading-relaxed">{children}</p>,

  blockquote: ({ children }) => (
    <div className="border-brand-orange/20 bg-brand-orange/5 my-6 rounded-xl border px-5 py-4">
      <div className="text-brand-orange [&>p]:text-brand-orange text-sm leading-relaxed [&>p]:mb-0">
        {children}
      </div>
    </div>
  ),

  ul: ({ children }) => <ul className="my-4 space-y-2 pl-0">{children}</ul>,

  ol: ({ children }) => <ol className="counter-reset-[item] my-4 space-y-2 pl-0">{children}</ol>,

  li: ({ children, ...props }) => {
    const isOrdered = props.node?.position && props.node.position.start.column > 0;

    return (
      <li className="text-muted-foreground flex gap-3 leading-relaxed">
        <span className="text-muted-foreground/60 mt-0.5 shrink-0 select-none" aria-hidden>
          {isOrdered ? "•" : "•"}
        </span>
        <span className="flex-1">{children}</span>
      </li>
    );
  },

  a: ({ href, children }) => (
    <a
      href={href}
      className="text-brand-orange decoration-brand-orange/30 hover:text-brand-orange/80 hover:decoration-brand-orange/50 font-medium underline underline-offset-2 transition-colors"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  ),

  strong: ({ children }) => (
    <strong className="text-foreground/90 font-semibold">{children}</strong>
  ),

  em: ({ children }) => <em className="text-foreground/80 italic">{children}</em>,

  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return <code className="block text-sm leading-relaxed">{children}</code>;
    }
    return (
      <code className="border-border/50 bg-foreground/5 text-brand-orange rounded-md border px-1.5 py-0.5 font-mono text-sm">
        {children}
      </code>
    );
  },

  pre: ({ children }) => (
    <pre className="border-border/50 bg-card text-foreground/90 my-6 overflow-x-auto rounded-xl border p-5 font-mono text-sm leading-relaxed">
      {children}
    </pre>
  ),

  table: ({ children }) => (
    <div className="border-border/50 my-6 overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),

  thead: ({ children }) => (
    <thead className="border-border/50 bg-foreground/5 border-b">{children}</thead>
  ),

  th: ({ children }) => (
    <th className="text-muted-foreground px-4 py-3 text-left text-xs font-bold tracking-wider uppercase">
      {children}
    </th>
  ),

  td: ({ children }) => (
    <td className="border-border/50 text-muted-foreground border-t px-4 py-3">{children}</td>
  ),

  hr: () => <hr className="border-border/50 my-10" />,

  img: ({ src, alt }) => (
    <span className="my-6 block">
      {/* eslint-disable-next-line -- suppress no-img-element: markdown renderer handles arbitrary external image URLs */}
      <img src={src} alt={alt ?? ""} className="border-border/50 max-w-full rounded-xl border" />
    </span>
  ),
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
