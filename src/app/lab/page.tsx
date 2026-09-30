import { notFound } from "next/navigation";
import { SpriteLab } from "./SpriteLab";

// Dev-only page for tuning the character's poses. 404s in production.
export default function LabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SpriteLab />;
}
