/**
 * 성경 각 책의 장 수를 API에서 확인하는 스크립트
 *
 * 사용법: node supabase/tests/fetch-bible-chapters.js
 */

const fs = require('fs');
const path = require('path');

const TOTAL_BOOKS = 66;

/**
 * 특정 책의 특정 장이 존재하는지 확인
 */
async function checkChapterExists(bibleCode, chapter) {
  const url = `https://goodtvbible.goodtv.co.kr/api/onlinebible/bibleread/read-all?version1=0&version2=&version3=&bible_code=${bibleCode}&jang=${chapter}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return false;

    const json = await response.json();
    const content = json.data?.data?.version1?.content || [];
    return content.length > 0;
  } catch {
    return false;
  }
}

/**
 * 이진 탐색으로 마지막 장 번호 찾기
 */
async function findLastChapter(bibleCode, maxChapter = 150) {
  let low = 1;
  let high = maxChapter;
  let lastValid = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const exists = await checkChapterExists(bibleCode, mid);

    if (exists) {
      lastValid = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }

    // API 부하 방지
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return lastValid;
}

/**
 * 책 이름 가져오기
 */
async function getBookName(bibleCode) {
  const url = `https://goodtvbible.goodtv.co.kr/api/onlinebible/bibleread/read-all?version1=0&version2=&version3=&bible_code=${bibleCode}&jang=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const json = await response.json();
    return json.data?.bookname || null;
  } catch {
    return null;
  }
}

/**
 * 메인 함수
 */
async function fetchBibleChapters() {
  console.log('성경 각 책의 장 수를 확인합니다...\n');

  const bibleChapterMap = {};

  for (let bibleCode = 1; bibleCode <= TOTAL_BOOKS; bibleCode++) {
    const bookName = await getBookName(bibleCode);
    const lastChapter = await findLastChapter(bibleCode);

    bibleChapterMap[bibleCode] = {
      name: bookName,
      chapters: lastChapter
    };

    console.log(`${bibleCode}. ${bookName}: ${lastChapter}장`);

    // API 부하 방지
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // 결과를 JS 파일로 저장
  const mapContent = `/**
 * 성경 각 책의 장 수 맵
 * API에서 자동 생성됨
 */
const BIBLE_CHAPTER_MAP = ${JSON.stringify(bibleChapterMap, null, 2)};

module.exports = { BIBLE_CHAPTER_MAP };
`;

  const outputPath = path.join(__dirname, 'bible-chapter-map.js');
  fs.writeFileSync(outputPath, mapContent, 'utf8');

  console.log(`\n결과 파일: ${outputPath}`);

  // 요약 출력
  console.log('\n========== 요약 ==========');
  const totalChapters = Object.values(bibleChapterMap).reduce((sum, b) => sum + b.chapters, 0);
  console.log(`총 ${TOTAL_BOOKS}권, ${totalChapters}장`);
}

fetchBibleChapters().catch(err => {
  console.error('오류 발생:', err);
  process.exit(1);
});
