import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { CodeSection } from "@/components/code-section";
import { Pricing } from "@/components/pricing";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Features />
        <CodeSection />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
