const supabase = require("@supabase/supabase-js");
const openai = require("openai");

// 환경변수로부터 API 키 값 가져오기
const supabaseUrl = "";
const supabaseKey = "";
const openaiApiKey = "";

// Supabase 및 OpenAI 클라이언트 생성
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
const openaiClient = new openai.OpenAI({ apiKey: openaiApiKey });

// 재시도 함수를 위한 지연 함수
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 각 단계별 최대 재시도 횟수
const maxRetries = 5;

// 구절 임베딩을 업데이트하는 함수
async function updateBibleEmbeddings(batchSize = 10) {
  let offset = 0;
  let batchNumber = 1;

  while (offset < 31138) {
    console.log(`\nProcessing batch #${batchNumber} (offset: ${offset})...`);

    let retryBatch = false; // 배치 전체를 다시 시도할지 여부

    // fetch 단계: `bible` 테이블에서 각 구절을 페치
    let verses;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { data, error: fetchError } = await supabaseClient
        .from("bible")
        .select("id, sentence")
        .order("id", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (fetchError) {
        console.error(
          `Fetch error on batch #${batchNumber}, attempt ${attempt}/${maxRetries}:`,
          fetchError
        );
        await delay(2 * 1000);
      } else {
        verses = data;
        console.log(`Fetched ${verses.length} verses from the database.`);
        break;
      }

      if (attempt === maxRetries) {
        console.error(
          `Failed to fetch batch #${batchNumber} after ${maxRetries} attempts. Retrying entire batch.`
        );
        retryBatch = true; // fetch 단계에서 실패 시 배치 전체 재시도
        break;
      }
    }
    if (retryBatch) {
      continue; // `while` 루프 시작으로 돌아가 해당 배치를 처음부터 다시 시도
    }

    // embedding 단계: 각 구절을 임베딩하여 OpenAI API에 요청
    let embeddings;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const responses = await openaiClient.embeddings.create({
          model: "text-embedding-3-small",
          input: verses.map((verse) => verse.sentence),
        });

        embeddings = responses.data.map((response) => response.embedding);
        console.log(
          `Successfully created embeddings for batch #${batchNumber}.`
        );
        break;
      } catch (apiError) {
        console.error(
          `Embedding error on batch #${batchNumber},\nattempt ${attempt}/${maxRetries}:`,
          apiError
        );
        await delay(2 * 1000);
      }

      if (attempt === maxRetries) {
        console.error(
          `Failed to create embeddings for batch #${batchNumber} after ${maxRetries} attempts. Retrying entire batch.`
        );
        retryBatch = true; // embedding 단계에서 실패 시 배치 전체 재시도
        break;
      }
    }
    if (retryBatch) {
      continue; // `while` 루프 시작으로 돌아가 해당 배치를 처음부터 다시 시도
    }

    // update 단계: Supabase에 임베딩 업데이트 (bulk update)
    const updates = verses.map((verse, index) => ({
      id: verse.id,
      embedding: embeddings[index],
    }));

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let updateErrors = false;
      for (let i = 0; i < updates.length; i++) {
        const { error: updateError } = await supabaseClient
          .from("bible")
          .update({ embedding: updates[i].embedding })
          .eq("id", updates[i].id);
        if (updateError) {
          updateErrors = true;
          break;
        }
      }

      if (updateErrors) {
        console.error(
          `Bulk update error on batch #${batchNumber}, attempt ${attempt}/${maxRetries}:`,
          updateErrors
        );
        await delay(2 * 1000);
      } else {
        console.log(
          `Successfully updated embeddings for batch #${batchNumber}`
        );
        break;
      }

      if (attempt === maxRetries) {
        console.error(
          `Failed to bulk update embeddings for batch #${batchNumber} after ${maxRetries} attempts. Retrying entire batch.`
        );
        retryBatch = true; // update 단계에서 실패 시 배치 전체 재시도
        break;
      }
    }
    if (retryBatch) {
      continue; // `while` 루프 시작으로 돌아가 해당 배치를 처음부터 다시 시도
    }

    // 다음 배치로 이동
    offset += batchSize;
    batchNumber++;
  }
}

// 함수 실행
updateBibleEmbeddings().then(() => {
  console.log("Embedding update complete.");
});
