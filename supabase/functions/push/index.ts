import { ProfilesRepository } from "./profilesRepository.ts";
import { FirebaseService } from "./firebaseService.ts";
import { NotificationRepository } from "./notificationRepository.ts";
import { Notification } from "../_types/table.ts";
import { NotificationType } from "../_types/notificationType.ts";

type InsertPayload = {
  type: "INSERT";
  table: string;
  schema: string;
  record: Notification;
  old_record: null;
};

Deno.serve(async (req) => {
  const payload: InsertPayload = await req.json();
  const notification = payload.record;

  const notificationRepo = new NotificationRepository();
  const profilesRepo = new ProfilesRepository();
  const firebaseService = new FirebaseService();

  const accessToken = await firebaseService.getAccessToken();
  if (!accessToken) {
    await notificationRepo.updateNotification(
      notification.id,
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

  const userId = notification.user_id;
  const userProfile = userId && await profilesRepo.getFCMTokenByUserId(userId);
  if (!userProfile || !userProfile.fcm_token) {
    await notificationRepo.updateNotification(
      notification.id,
      {
        completed_at: new Date().toISOString(),
        fcm_result: { fcm_token: "", status: "NOT_EXIST_FCM" },
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
      notification.id,
      {
        completed_at: new Date().toISOString(),
        fcm_result: fcmResult,
      },
    );
    return new Response(JSON.stringify(fcmResult), {
      headers: { "Content-Type": "application/json" },
    });
  }
  if (notification.type == NotificationType.NOTICE) {
    const fcmResult = { fcmToken: "", status: "SKIP_PUSH_NOTIFICATION" };
    await notificationRepo.updateNotification(
      notification.id,
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
    notification,
    accessToken,
  );
  await notificationRepo.updateNotification(
    notification.id,
    {
      completed_at: new Date().toISOString(),
      fcm_result: { fcm_token: fcmResult.fcmToken, status: fcmResult.status },
    },
  );
  return new Response(JSON.stringify(fcmResult), {
    headers: { "Content-Type": "application/json" },
  });
});
