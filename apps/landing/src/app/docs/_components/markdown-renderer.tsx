import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkAlert } from "remark-github-blockquote-alert";
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

/**
 * Maps GitHub alert types to design-token-based color classes.
 * TIP = success green, WARNING = semantic warning amber, CAUTION = destructive red,
 * NOTE/IMPORTANT/default = brand orange.
 */
const alertStyles: Record<string, { border: string; bg: string; text: string }> = {
  tip: {
    border: "border-[var(--success)]/20",
    bg: "bg-[var(--success)]/5",
    text: "text-[var(--success)]",
  },
  warning: {
    border: "border-[var(--warning)]/20",
    bg: "bg-[var(--warning)]/5",
    text: "text-[var(--warning)]",
  },
  caution: {
    border: "border-[var(--destructive)]/20",
    bg: "bg-[var(--destructive)]/5",
    text: "text-[var(--destructive)]",
  },
};

const defaultAlertStyle = {
  border: "border-brand-orange/20",
  bg: "bg-brand-orange/5",
  text: "text-brand-orange",
};

function getAlertStyle(classNames: string | undefined) {
  if (!classNames) return null;
  const match = classNames.match(/markdown-alert-(\w+)/);
  if (!match?.[1]) return null;
  return alertStyles[match[1]] ?? defaultAlertStyle;
}

function createComponents(locale: "nb" | "en"): Components {
  return {
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

    p: ({ children, ...props }) => {
      // Alert title paragraph from remark-github-blockquote-alert
      const className =
        props.node?.properties?.className ?? (props as Record<string, unknown>).className;
      if (
        typeof className === "string"
          ? className.includes("markdown-alert-title")
          : Array.isArray(className) && className.includes("markdown-alert-title")
      ) {
        return (
          <p className="mb-2 flex items-center gap-2 text-sm font-bold tracking-wider uppercase">
            {children}
          </p>
        );
      }
      return <p className="text-muted-foreground mb-4 leading-relaxed">{children}</p>;
    },

    // The remark-github-blockquote-alert plugin transforms alert blockquotes into divs
    div: ({ children, ...props }) => {
      const className =
        props.node?.properties?.className ?? (props as Record<string, unknown>).className;
      const classStr = Array.isArray(className)
        ? className.join(" ")
        : typeof className === "string"
          ? className
          : "";
      const style = getAlertStyle(classStr);

      if (style) {
        return (
          <div className={`${style.border} ${style.bg} my-6 rounded-xl border px-5 py-4`}>
            <div className={`${style.text} text-sm leading-relaxed [&>p]:mb-0`}>{children}</div>
          </div>
        );
      }

      return <div>{children}</div>;
    },

    blockquote: ({ children }) => (
      <div className="border-brand-orange/20 bg-brand-orange/5 my-6 rounded-xl border px-5 py-4">
        <div className="text-brand-orange [&>p]:text-brand-orange text-sm leading-relaxed [&>p]:mb-0">
          {children}
        </div>
      </div>
    ),

    ul: ({ children }) => <ul className="my-4 space-y-2 pl-0">{children}</ul>,

    ol: ({ children }) => {
      // Inject step numbers via CSS counter — ol items rendered as step cards use this
      let stepIndex = 0;
      const numberedChildren = Array.isArray(children)
        ? children.map((child) => {
            if (child && typeof child === "object" && "type" in child && child.type === "li") {
              stepIndex += 1;
              return { ...child, props: { ...child.props, "data-step": stepIndex } };
            }
            return child;
          })
        : children;
      return <ol className="my-4 space-y-3 pl-0">{numberedChildren}</ol>;
    },

    li: ({ children, node, ...props }) => {
      // Detect if parent is <ol> by checking node's parent tag in the AST
      const parentTag = node?.properties?.["data-parent"] as string | undefined;
      const stepNumber = (props as Record<string, unknown>)["data-step"] as number | undefined;
      const isOrdered = stepNumber != null;

      // Step card: ordered list item where first child is <strong>
      if (isOrdered) {
        const childArray = Array.isArray(children) ? children : [children];
        const firstChild = childArray[0];
        const hasStrongLead =
          firstChild &&
          typeof firstChild === "object" &&
          "type" in firstChild &&
          (firstChild as { type?: string }).type === "strong";

        if (hasStrongLead) {
          return (
            <li className="border-border/50 bg-card flex gap-4 rounded-xl border p-4">
              <span className="bg-brand-orange/10 text-brand-orange flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                {stepNumber}
              </span>
              <span className="text-muted-foreground [&>strong]:text-foreground/90 flex-1 leading-relaxed">
                {children}
              </span>
            </li>
          );
        }
      }

      // Feature highlight: unordered list item where content starts with <strong>text</strong> followed by " — "
      if (!isOrdered) {
        const textContent = extractText(children);
        const hasFeaturePattern = textContent.includes("\u2014");
        const childArray = Array.isArray(children) ? children : [children];
        const firstChild = childArray[0];
        const hasStrongLead =
          firstChild &&
          typeof firstChild === "object" &&
          "type" in firstChild &&
          (firstChild as { type?: string }).type === "strong";

        if (hasStrongLead && hasFeaturePattern) {
          return (
            <li className="border-border/50 bg-card text-muted-foreground [&>strong]:text-foreground/90 rounded-xl border p-4 leading-relaxed [&>strong]:font-semibold">
              {children}
            </li>
          );
        }
      }

      void parentTag;
      return (
        <li className="text-muted-foreground flex gap-3 leading-relaxed">
          <span className="text-muted-foreground/60 mt-0.5 shrink-0 select-none" aria-hidden>
            {isOrdered ? "" : "\u2022"}
          </span>
          <span className="flex-1">{children}</span>
        </li>
      );
    },

    a: ({ href, children }) => {
      let resolvedHref = href;
      if (locale === "en" && href?.startsWith("/docs/")) {
        resolvedHref = `/en${href}`;
      }
      return (
        <a
          href={resolvedHref}
          className="text-brand-orange decoration-brand-orange/30 hover:text-brand-orange/80 hover:decoration-brand-orange/50 font-medium underline underline-offset-2 transition-colors"
          target={resolvedHref?.startsWith("http") ? "_blank" : undefined}
          rel={resolvedHref?.startsWith("http") ? "noopener noreferrer" : undefined}
        >
          {children}
        </a>
      );
    },

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
}

export function MarkdownRenderer({
  content,
  locale = "nb",
}: {
  content: string;
  locale?: "nb" | "en";
}) {
  const components = createComponents(locale);
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkAlert]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
