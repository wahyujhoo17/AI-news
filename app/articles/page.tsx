import { redirect } from "next/navigation"

// /articles has no index — redirect to homepage where all articles are listed
export default function ArticlesIndexPage() {
  redirect("/")
}
