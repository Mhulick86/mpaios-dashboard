import { requireAuth } from "@/lib/apiAuth";
import {
  listCampaigns,
  createCampaignDraft,
  type CreateCampaignInput,
} from "@/lib/metaAds";

interface ListBody {
  accessToken: string;
  accountId: string;
  limit?: number;
}

interface CreateBody {
  accessToken: string;
  accountId: string;
  campaign: CreateCampaignInput;
}

/** List campaigns for an ad account. */
export async function POST(req: Request) {
  try {
    await requireAuth();
    const body = (await req.json()) as ListBody;
    if (!body.accessToken || !body.accountId) {
      return Response.json(
        { error: "accessToken and accountId are required" },
        { status: 400 }
      );
    }
    const campaigns = await listCampaigns(body.accessToken, body.accountId, body.limit ?? 100);
    return Response.json({ campaigns });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to list campaigns" },
      { status: 500 }
    );
  }
}

/**
 * Create a campaign DRAFT. Always PAUSED — per system.md line 77,
 * we never auto-activate. Human must activate in Ads Manager.
 */
export async function PUT(req: Request) {
  try {
    await requireAuth();
    const body = (await req.json()) as CreateBody;
    if (!body.accessToken || !body.accountId || !body.campaign) {
      return Response.json(
        { error: "accessToken, accountId and campaign are required" },
        { status: 400 }
      );
    }
    if (!body.campaign.name || !body.campaign.objective) {
      return Response.json(
        { error: "campaign.name and campaign.objective are required" },
        { status: 400 }
      );
    }

    const result = await createCampaignDraft(body.accessToken, body.accountId, body.campaign);
    return Response.json({
      id: result.id,
      status: "PAUSED",
      note: "Campaign created as DRAFT (PAUSED). Activate it in Meta Ads Manager after human review.",
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create campaign" },
      { status: 500 }
    );
  }
}
