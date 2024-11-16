import { ProfilesRepository } from "../_repo/profilesRepository.ts";
import { FirebaseService } from "../_shared/firebaseService.ts";

type BulkPushPayload = {
  title: string;
  body: string;
  startId?: string;
};

Deno.serve(async (req) => {
  const payload: BulkPushPayload = await req.json();
  const { title, body } = payload;

  const profilesRepo = new ProfilesRepository();
  const firebaseService = new FirebaseService();

  const accessToken = await firebaseService.getAccessToken();
  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: "Failed to get access token" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }

  let startId = payload.startId || "";
  let hasMoreData = true;
  const limit = 500;

  while (hasMoreData) {
    const profiles = await profilesRepo.fetchFCMToken(startId, limit);
    if (!profiles) {
      hasMoreData = false;
      return new Response(
        JSON.stringify({ status: "ERROR_FETCH_PROFILES", startId: startId }),
        { headers: { "Content-Type": "application/json" }, status: 500 },
      );
    }
    const fcmResult = await firebaseService.sendNotification(
      accessToken,
      profiles.map((profile) => profile.fcm_token),
      title,
      body,
    );
    if (fcmResult.status !== "SUCCESS") {
      hasMoreData = false;
      return new Response(
        JSON.stringify({ status: fcmResult.status, startId: startId }),
        { headers: { "Content-Type": "application/json" }, status: 500 },
      );
    }
    if (profiles.length < 500) hasMoreData = false;
    else startId = profiles[profiles.length - 1].id;
  }
  return new Response(JSON.stringify({ status: "SUCCESS" }), {
    headers: { "Content-Type": "application/json" },
  });
});
