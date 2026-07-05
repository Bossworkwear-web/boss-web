import { CategoryBrowseCatalogPrefetch } from "@/app/components/category-browse-catalog-prefetch";

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CategoryBrowseCatalogPrefetch />
      {children}
    </>
  );
}
