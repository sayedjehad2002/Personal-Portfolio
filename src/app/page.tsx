import { Experience } from "@/components/Experience";

export default function Home() {
  return (
    <>
      {/* the opening shot: fetched first so the page opens straight into the world (React hoists this into <head>) */}
      <link rel="preload" as="image" href="/scenes/open/base-camp.webp" fetchPriority="high" />
      <Experience />
    </>
  );
}
