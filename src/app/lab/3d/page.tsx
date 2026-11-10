import { notFound } from "next/navigation";
import { Lab3D } from "./Lab3D";

// Dev-only page for the World 2 character: every animation and every realm outfit. 404s in production.
export default function Lab3DPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Lab3D />;
}
