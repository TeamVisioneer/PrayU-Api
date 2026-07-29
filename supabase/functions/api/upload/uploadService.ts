/**
 * S3 호환 스토리지(Cloudflare R2)용 **사전 서명 PUT URL** 발급.
 *
 * R2 에는 RLS 가 없다. 브라우저가 직접 올리게 하려면 서버가 "이 키에, 이 타입으로,
 * 이 시간 안에만" 이라고 서명한 URL 을 내줘야 한다. 시크릿은 함수에만 있고 브라우저로 나가지 않는다.
 *
 * AWS Signature Version 4 (query string 방식). R2 는 S3 API 를 그대로 받는다.
 * 같은 규격이라 로컬 Supabase 의 S3 호환 엔드포인트로도 검증할 수 있다.
 */

const encoder = new TextEncoder();

const sha256Hex = async (data: string): Promise<string> => {
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const hmac = async (key: ArrayBuffer | Uint8Array, data: string) => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
};

const hex = (buf: ArrayBuffer): string =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** 경로의 각 구간을 인코딩한다. `/` 는 구분자로 남긴다 */
const encodeKey = (key: string): string =>
  key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export interface PresignOptions {
  endpoint: string; // 예: https://<account>.r2.cloudflarestorage.com
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  /** 유효 시간(초). 짧게 둔다 — 발급 후 바로 올리는 용도다 */
  expiresIn?: number;
  /** 서명에 묶어 다른 타입으로 올리지 못하게 한다 */
  contentType: string;
  /** 서명 시각. 테스트에서 고정하기 위해 주입 가능하게 둔다 */
  now?: Date;
}

export const presignPutUrl = async ({
  endpoint,
  bucket,
  key,
  accessKeyId,
  secretAccessKey,
  region = "auto",
  expiresIn = 300,
  contentType,
  now = new Date(),
}: PresignOptions): Promise<string> => {
  const service = "s3";
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20260729T072300Z
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;

  const url = new URL(endpoint);
  const host = url.host;
  // 엔드포인트에 경로가 붙어 있을 수 있다 (R2 는 없지만, S3 호환 구현 중에는 있다).
  // 서명 대상 경로에 그 접두사를 포함해야 검증이 통과한다.
  const prefix = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  const canonicalUri = `${prefix}/${encodeKey(bucket)}/${encodeKey(key)}`;

  // content-type 도 서명에 포함한다 — 발급받은 URL 로 다른 타입을 올리지 못한다
  const signedHeaders = "content-type;host";
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;

  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": signedHeaders,
  });
  // AWS 는 쿼리 파라미터가 키 순으로 정렬돼 있기를 요구한다
  const canonicalQuery = [...query.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  let signingKey = await hmac(
    encoder.encode(`AWS4${secretAccessKey}`),
    dateStamp,
  );
  for (const part of [region, service, "aws4_request"]) {
    signingKey = await hmac(signingKey, part);
  }
  const signature = hex(await hmac(signingKey, stringToSign));

  return `${url.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
};
