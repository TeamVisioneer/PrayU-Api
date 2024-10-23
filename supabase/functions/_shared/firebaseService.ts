import { JWT } from "npm:google-auth-library@9";
import { Notification } from "../_types/table.ts";

export class FirebaseService {
  async getAccessToken() {
    try {
      const jwtClient = new JWT({
        email: Deno.env.get("FIREBASE_CLIENT_EMAIL"),
        key: Deno.env.get("FIREBASE_PRIVATE_KEY")!.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
      });
      const token = await jwtClient.authorize();
      return token.access_token || null;
    } catch (error) {
      console.error("Error getting access token:", error.message);
      return null;
    }
  }

  async sendNotification(
    accessToken: string,
    fcmTokens: string[],
    title: string,
    body: string,
  ) {
    try {
      const firebaseProjectID = Deno.env.get("FIREBASE_PROJECT_ID");
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${firebaseProjectID}/messages:send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token: fcmTokens,
              notification: {
                title: title,
                body: body,
              },
            },
          }),
        },
      );

      const resData = await res.json();

      if (res.status < 200 || 299 < res.status) {
        const errorCode = resData.error?.details?.[0]?.errorCode ||
          resData.error?.status || "UNKNOWN_ERROR";
        console.error(`Error sending FCM message: ${errorCode}`);
        return { status: `Error sending FCM message: ${errorCode}` };
      } else {
        return { status: "SUCCESS" };
      }
    } catch (err) {
      return { status: `Error sending FCM message: ${err.message}` };
    }
  }
}
