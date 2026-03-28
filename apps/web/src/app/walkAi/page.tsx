import dynamic from "next/dynamic";

const WalkAiPlayground = dynamic(
  () => import("./_components/WalkAiPlayground").then((m) => m.WalkAiPlayground),
  { ssr: false },
);

export default function WalkAiPage() {
  return <WalkAiPlayground />;
}
