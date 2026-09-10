import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Wizard from "@/components/Wizard";
import Guide from "@/components/Guide";
import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import IntroLoader from "@/components/IntroLoader";
import ScrollProgress from "@/components/ScrollProgress";
import BackToTop from "@/components/BackToTop";
import { SelectionProvider } from "@/components/SelectionProvider";

export default function Site() {
  return (
    <div id="top">
      <SelectionProvider>
      <ScrollProgress />
      <IntroLoader />
      <Nav />
      <main id="main">
        <Hero />
        <HowItWorks />
        <Wizard />
        <Guide />
        <Faq />
      </main>
      <Footer />
      <BackToTop />
      </SelectionProvider>
    </div>
  );
}
