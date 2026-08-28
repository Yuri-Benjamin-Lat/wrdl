import { notFound } from "next/navigation";
import { ComponentGallery } from "@/components/gallery/component-gallery";

export default function ComponentsPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ComponentGallery />;
}
