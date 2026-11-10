import { SmoothScroll } from "@/components/SmoothScroll";
import { World3D } from "@/components/world3d/World3D";

export default function Home() {
  return (
    <>
      {/* the opening shot: fetched first so the page opens straight into the world (React hoists these into <head>) */}
      <link rel="preload" as="image" href="/world/first-frame.jpg" media="(min-width: 641px)" fetchPriority="high" />
      <link rel="preload" as="image" href="/world/first-frame-phone.jpg" media="(max-width: 640px)" fetchPriority="high" />
      <SmoothScroll>
        <World3D />
      </SmoothScroll>
    </>
  );
}
