import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Wizard from "@/components/Wizard";
import Guide from "@/components/Guide";
import Features from "@/components/Features";
import Faq from "@/components/Faq";
import Closing from "@/components/Closing";
import Footer from "@/components/Footer";
import IntroLoader from "@/components/IntroLoader";
import ScrollProgress from "@/components/ScrollProgress";
import BackToTop from "@/components/BackToTop";

export default function Home() {
  return (
    <div id="top">
      <ScrollProgress />
      <IntroLoader />
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Wizard />
        <Guide />
        <Features />
        <Faq />
        <Closing />
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
}
