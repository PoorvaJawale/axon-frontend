import Link from "next/link";
import { PageFrame } from "@/components/public/page-frame";
import { IntegrationGuide } from "@/components/integration-guide";
export default function Docs() {
  return (
    <PageFrame
      active="Docs"
      title="Integrate Axon."
      description="Validate an action before execution. Choose one execution owner for each request."
    >
      <IntegrationGuide />
      <p>
        <Link href="/api-reference">API reference</Link>
      </p>
    </PageFrame>
  );
}
