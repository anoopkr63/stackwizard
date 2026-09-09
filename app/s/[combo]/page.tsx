import Site from "@/components/Site";

// Shared setups live at short route URLs: /s/l:typescript+f:nextjs+db:supabase
// The combo segment is read client-side by the wizard; any unknown combo
// simply loads the default blank page.
export default function SharedSetup() {
  return <Site />;
}
