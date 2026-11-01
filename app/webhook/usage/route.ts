import { accountRoute } from "@/lib/account";
import { accountUsage } from "@/lib/account-data";
export async function GET(request: Request) {
  return accountRoute(request, accountUsage);
}
