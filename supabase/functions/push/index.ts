import { ProfilesRepository } from "./profilesRepository.ts";
import { FirebaseService } from "./firebaseService.ts";
import { NotificationRepository } from "./notificationRepository.ts";
import { Notification } from "../_types/table.ts";

interface Payload {
  type: "INSERT";
  table: string;
  notification: Notification;
  schema: "public";
}

Deno.serve(async (req) => {
  const payload: Payload = await req.json();

  const notificationRepo = new NotificationRepository();
  const profilesRepo = new ProfilesRepository();
  const firebaseService = new FirebaseService();

  const accessToken = await firebaseService.getAccessToken();
  if (!accessToken) {
    await notificationRepo.updateNotification(
      payload.notification.id,
      {
        completed_at: new Date().toISOString(),
        fcm_result: { fcm_token: "", status: "NO_ACCESS" },
      },
    );
    return new Response(
      JSON.stringify({ error: "Failed to get access token" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }

  const userProfile = await profilesRepo.getFCMTokenByUserId(
    payload.notification.user_id,
  );
  if (!userProfile) {
    await notificationRepo.updateNotification(
      payload.notification.id,
      {
        completed_at: new Date().toISOString(),
        fcm_result: { fcm_token: "", status: "NOT_EXIST_USER" },
      },
    );
    return new Response(
      JSON.stringify({ error: "No FCM tokens found for the user" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 404,
      },
    );
  }
  if (!userProfile.push_notification) {
    const fcmResult = { fcmToken: "", status: "DISABLED_PUSH_NOTIFICATION" };
    await notificationRepo.updateNotification(
      payload.notification.id,
      {
        completed_at: new Date().toISOString(),
        fcm_result: fcmResult,
      },
    );
    return new Response(JSON.stringify(fcmResult), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const fcmResult = await firebaseService.sendNotification(
    userProfile.fcm_token,
    payload.notification,
    accessToken,
  );
  await notificationRepo.updateNotification(
    payload.notification.id,
    {
      completed_at: new Date().toISOString(),
      fcm_result: { fcm_token: fcmResult.fcmToken, status: fcmResult.status },
    },
  );
  return new Response(JSON.stringify(fcmResult), {
    headers: { "Content-Type": "application/json" },
  });
});
