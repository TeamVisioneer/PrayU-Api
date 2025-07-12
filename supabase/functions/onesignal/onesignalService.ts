import {
  OnesignalClient,
  OnesignalUpdateUserRequestBody,
} from "./onesignalClient.ts";
import { supabase } from "../client.ts";
import { Json } from "../_types/database.ts";

export class OnesignalService {
  private onesignalClient;
  private appId: string;
  private androidChannelId: string;

  constructor() {
    this.appId = Deno.env.get("ONESIGNAL_APP_ID") as string;
    this.androidChannelId = Deno.env.get(
      "ONESIGNAL_ANDROID_CHANNEL_ID",
    ) as string;
    this.onesignalClient = new OnesignalClient(
      Deno.env.get("ONESIGNAL_API_KEY") as string,
      Deno.env.get("ONESIGNAL_APP_ID") as string,
    );
  }

  async sendNotification(requestBody: {
    title: string;
    subtitle: string;
    message: string;
    data: unknown;
    userIds?: string[];
    segments?: string[];
  }) {
    const baseProperties = {
      app_id: this.appId,
      android_channel_id: this.androidChannelId,
      target_channel: "push",
      small_icon: "ic_stat_onesignal_default",
      ios_badgeType: "Increase",
      ios_badgeCount: 1,
      data: requestBody.data,
      headings: { en: requestBody.title },
      subtitle: { en: requestBody.subtitle },
      contents: { en: requestBody.message },
    };
    const additionalProperties = {
      ...(requestBody.userIds &&
        { include_external_user_ids: requestBody.userIds }),
      ...(requestBody.segments && { included_segments: requestBody.segments }),
    };
    const onesignalRequestBody = {
      ...baseProperties,
      ...additionalProperties,
    };

    const apiResponse = await this.onesignalClient.sendNotification(
      onesignalRequestBody,
    );
    return apiResponse;
  }

  async sendPrayTimeReminderNotification(requestBody: {
    prayTime: string;
  }) {
    try {
      const { data: groups, error: groupError } = await supabase
        .from("group")
        .select(`
          id,
          name,
          member!inner( user_id )
        `)
        .eq("pray_time", requestBody.prayTime)
        .is("deleted_at", null);

      if (groupError) {
        throw new Error(`Failed to fetch groups: ${groupError.message}`);
      }

      if (!groups || groups.length === 0) {
        return {
          data: null,
          errors: ["No groups found for the specified pray time"],
        };
      }

      type NotificationParams = {
        title: string;
        body: string;
        type: string;
        data: Json;
        user_id: string;
        group_id: string;
        sender_id: string | null;
      };

      // 각 멤버를 위한 notification 생성 파라미터 목록
      const allNotificationParams: NotificationParams[] = [];
      const allUserIds: string[] = [];

      // 13시 -> 1시 포멧으로 변경 (오전, 오후 고려)
      const prayTimeHour = parseInt(requestBody.prayTime.split(":")[0]) > 12
        ? (parseInt(requestBody.prayTime.split(":")[0]) - 12) + "시"
        : parseInt(requestBody.prayTime.split(":")[0]) + "시";

      groups.forEach((group) => {
        const notificationParams: NotificationParams[] = group.member
          .filter((member): member is { user_id: string } =>
            member.user_id !== null
          )
          .map(
            (member) => ({
              title: `⏰ ${prayTimeHour} ${group.name} 그룹 기도`,
              body: "하루 중 가장 소중한 몇 분, 함께 모여 기도해요!",
              type: "reminder",
              data: {
                url: "/notifications",
                pray_time: requestBody.prayTime,
                group_id: group.id,
                group_name: group.name,
              } as Json,
              user_id: member.user_id,
              group_id: group.id,
              sender_id: null,
            }),
          );
        const groupUserIds = notificationParams.map((param) => param.user_id);

        allNotificationParams.push(...notificationParams);
        allUserIds.push(...groupUserIds);
      });

      // 중복 제거
      const uniqueUserIds = [...new Set(allUserIds)];

      if (uniqueUserIds.length === 0) {
        return {
          data: null,
          errors: ["No users found to send notifications"],
        };
      }

      // 3. 데이터베이스에 notification 레코드들 생성
      const { error: notificationError } = await supabase
        .from("notification")
        .insert(allNotificationParams);

      if (notificationError) {
        return {
          data: null,
          errors: [notificationError.message],
        };
      }

      // 4. 하드코딩된 메시지와 데이터로 푸시 알림 전송 (한 번만 호출)
      const notificationData = {
        title: `⏰ ${prayTimeHour} 그룹 기도`,
        subtitle: ``,
        message: "하루 중 가장 소중한 몇 분, 함께 모여 기도해요!",
        data: {
          url: "/notifications",
          pray_time: requestBody.prayTime,
        },
        userIds: uniqueUserIds,
      };

      const apiResponse = await this.sendNotification(notificationData);

      return {
        data: apiResponse,
        errors: null,
      };
    } catch (error) {
      return {
        data: null,
        errors: [
          `Failed to send pray time reminder notification: ${error.message}`,
        ],
      };
    }
  }

  async updateUser(requestBody: {
    userId: string;
    body: OnesignalUpdateUserRequestBody;
  }) {
    const apiResponse = await this.onesignalClient.updateUser(
      requestBody.userId,
      requestBody.body,
    );
    return apiResponse;
  }
}
