import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Wizard from "@/components/Wizard";
import Features from "@/components/Features";
import Faq from "@/components/Faq";
import Closing from "@/components/Closing";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div id="top">
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Wizard />
        <Features />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
