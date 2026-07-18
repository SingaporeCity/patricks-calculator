import { getAuthors, getProducts, isDemoMode } from "@/lib/data";
import { NewContractForm } from "@/components/NewContractForm";
import { Page, PageHeader } from "@/components/ui";

export default async function NieuwContractPage() {
  const [products, authors] = await Promise.all([getProducts(), getAuthors()]);
  const sortedAuthors = [...authors].sort((a, b) => a.lastName.localeCompare(b.lastName));

  return (
    <Page>
      <PageHeader
        title="Nieuw contract"
        description="Koppel producten en auteurs aan een royalty-afspraak. Na opslaan wordt meteen herberekend."
        back={{ href: "/contracten", label: "Contracten" }}
      />
      <NewContractForm products={products} authors={sortedAuthors} demoMode={isDemoMode} />
    </Page>
  );
}
