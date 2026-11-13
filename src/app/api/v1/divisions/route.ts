import { DIVISIONS } from "@/lib/domain/divisions";
import { apiSuccess } from "@/lib/domain/statuses";

export async function GET() {
  return apiSuccess(DIVISIONS);
}
