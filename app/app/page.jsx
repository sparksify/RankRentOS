import { redirect } from "next/navigation";
// The legacy Market Board (now at /board, unlinked) queried runs/markets tables that
// existed only in the deleted LeadGenScout project. The cockpit is the working home.
export default function Home() { redirect("/cockpit"); }
