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
        className="mb-2 text-4xl leading-tight font-black tracking-tighter text-white md:text-[2.5rem]"
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
        className="group mt-14 mb-4 flex scroll-mt-24 items-center gap-2 text-2xl font-bold tracking-tight text-white"
      >
        <a
          href={`#${id}`}
          className="text-lg text-zinc-600 opacity-0 transition-all group-hover:opacity-100 hover:text-orange-400"
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
      <h3 id={id} className="mt-8 mb-3 scroll-mt-24 text-lg font-bold tracking-tight text-zinc-200">
        {children}
      </h3>
    );
  },

  h4: ({ children }) => <h4 className="mt-6 mb-2 text-base font-bold text-zinc-300">{children}</h4>,

  p: ({ children }) => <p className="mb-4 leading-relaxed text-zinc-400">{children}</p>,

  blockquote: ({ children }) => (
    <div className="my-6 rounded-xl border border-orange-500/20 bg-orange-500/5 px-5 py-4">
      <div className="text-sm leading-relaxed text-orange-300/90 [&>p]:mb-0 [&>p]:text-orange-300/90">
        {children}
      </div>
    </div>
  ),

  ul: ({ children }) => <ul className="my-4 space-y-2 pl-0">{children}</ul>,

  ol: ({ children }) => <ol className="counter-reset-[item] my-4 space-y-2 pl-0">{children}</ol>,

  li: ({ children, ...props }) => {
    const isOrdered = props.node?.position && props.node.position.start.column > 0;

    return (
      <li className="flex gap-3 leading-relaxed text-zinc-400">
        <span className="mt-0.5 shrink-0 text-zinc-600 select-none" aria-hidden>
          {isOrdered ? "•" : "•"}
        </span>
        <span className="flex-1">{children}</span>
      </li>
    );
  },

  a: ({ href, children }) => (
    <a
      href={href}
      className="font-medium text-orange-400 underline decoration-orange-400/30 underline-offset-2 transition-colors hover:text-orange-300 hover:decoration-orange-300/50"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  ),

  strong: ({ children }) => <strong className="font-semibold text-zinc-200">{children}</strong>,

  em: ({ children }) => <em className="text-zinc-300 italic">{children}</em>,

  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return <code className="block text-sm leading-relaxed">{children}</code>;
    }
    return (
      <code className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-sm text-orange-300">
        {children}
      </code>
    );
  },

  pre: ({ children }) => (
    <pre className="my-6 overflow-x-auto rounded-xl border border-white/[0.06] bg-[#0c0c0e] p-5 font-mono text-sm leading-relaxed text-zinc-300">
      {children}
    </pre>
  ),

  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-white/[0.06]">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),

  thead: ({ children }) => (
    <thead className="border-b border-white/[0.06] bg-white/[0.03]">{children}</thead>
  ),

  th: ({ children }) => (
    <th className="px-4 py-3 text-left text-xs font-bold tracking-wider text-zinc-400 uppercase">
      {children}
    </th>
  ),

  td: ({ children }) => (
    <td className="border-t border-white/[0.04] px-4 py-3 text-zinc-400">{children}</td>
  ),

  hr: () => <hr className="my-10 border-white/5" />,

  img: ({ src, alt }) => (
    <span className="my-6 block">
      {/* eslint-disable-next-line -- suppress no-img-element: markdown renderer handles arbitrary external image URLs */}
      <img src={src} alt={alt ?? ""} className="max-w-full rounded-xl border border-white/[0.06]" />
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
