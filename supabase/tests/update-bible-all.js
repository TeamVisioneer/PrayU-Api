/**
 * 성경 전체 데이터를 API에서 가져와 DB의 sentence를 update하는 스크립트
 *
 * 사용법: node supabase/tests/update-bible-all.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { BIBLE_CHAPTER_MAP } = require('./bible-chapter-map');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPA_PROJECT_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPA_PROJECT_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('환경변수 SUPA_PROJECT_URL, SUPA_PROJECT_SERVICE_ROLE_KEY가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 결과 파일 경로
const RESULT_FILE = path.join(__dirname, 'update-bible-progress.json');

/**
 * 진행 상황 파일 초기화
 */
function initProgressFile() {
  const totalChapters = Object.values(BIBLE_CHAPTER_MAP).reduce((sum, b) => sum + b.chapters, 0);

  const progress = {
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'running',
    totalBooks: 66,
    totalChapters: totalChapters,
    completedChapters: 0,
    completedVerses: 0,
    errors: [],
    books: {}
  };

  // 각 책의 초기 상태 설정
  for (const [code, info] of Object.entries(BIBLE_CHAPTER_MAP)) {
    progress.books[code] = {
      name: info.name,
      totalChapters: info.chapters,
      completedChapters: 0,
      completedVerses: 0,
      status: 'pending',
      chapters: {}
    };
    // 각 장의 초기 상태
    for (let ch = 1; ch <= info.chapters; ch++) {
      progress.books[code].chapters[ch] = { status: 'pending', verses: 0 };
    }
  }

  fs.writeFileSync(RESULT_FILE, JSON.stringify(progress, null, 2), 'utf8');
  return progress;
}

/**
 * 진행 상황 업데이트
 */
function updateProgress(progress) {
  fs.writeFileSync(RESULT_FILE, JSON.stringify(progress, null, 2), 'utf8');
}

/**
 * API에서 특정 장의 성경 데이터를 가져옵니다.
 */
async function fetchChapterFromAPI(bibleCode, chapter) {
  const url = `https://goodtvbible.goodtv.co.kr/api/onlinebible/bibleread/read-all?version1=0&version2=&version3=&bible_code=${bibleCode}&jang=${chapter}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  const json = await response.json();
  const verses = json.data?.data?.version1?.content || [];

  return verses.map(v => ({
    paragraph: v.jul,
    sentence: v.text
  }));
}

/**
 * DB에서 특정 장의 특정 절을 update
 */
async function updateVerse(bibleCode, chapter, paragraph, sentence) {
  const { error } = await supabase
    .from('bible')
    .update({ sentence })
    .eq('book', bibleCode)
    .eq('chapter', chapter)
    .eq('paragraph', paragraph);

  if (error) {
    throw new Error(`DB update 실패: ${error.message}`);
  }
}

/**
 * 메인 함수
 */
async function updateBibleAll() {
  console.log('성경 전체 데이터 update를 시작합니다...\n');

  // 진행 상황 파일 초기화
  const progress = initProgressFile();
  console.log(`진행 상황 파일: ${RESULT_FILE}\n`);

  const startTime = Date.now();
  const bibleBooks = Object.entries(BIBLE_CHAPTER_MAP);

  for (const [bibleCode, bookInfo] of bibleBooks) {
    const code = parseInt(bibleCode);
    const { name, chapters } = bookInfo;

    console.log(`\n[${code}/66] ${name} (${chapters}장)`);
    progress.books[code].status = 'running';
    updateProgress(progress);

    for (let chapter = 1; chapter <= chapters; chapter++) {
      try {
        // API에서 데이터 가져오기
        const verses = await fetchChapterFromAPI(code, chapter);

        // 각 절을 update
        for (const verse of verses) {
          await updateVerse(code, chapter, verse.paragraph, verse.sentence);
        }

        // 장 완료 상태 업데이트
        progress.books[code].chapters[chapter] = { status: 'completed', verses: verses.length };
        progress.books[code].completedChapters++;
        progress.books[code].completedVerses += verses.length;
        progress.completedChapters++;
        progress.completedVerses += verses.length;
        updateProgress(progress);

        process.stdout.write(`   ${chapter}/${chapters}장 완료 (${verses.length}절)\r`);

      } catch (err) {
        const errorMsg = `${name} ${chapter}장: ${err.message}`;
        progress.errors.push(errorMsg);
        progress.books[code].chapters[chapter] = { status: 'error', error: err.message };
        updateProgress(progress);
        console.error(`\n   ! ${errorMsg}`);
      }

      // API 부하 방지를 위한 딜레이
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 책 완료 상태 업데이트
    progress.books[code].status = 'completed';
    updateProgress(progress);
    console.log(`   ${name} 완료!                    `);
  }

  // 최종 상태 업데이트
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  progress.status = 'completed';
  progress.completedAt = new Date().toISOString();
  progress.elapsedMinutes = parseFloat(elapsed);
  updateProgress(progress);

  console.log('\n========== 완료 ==========');
  console.log(`총 ${progress.completedChapters}장, ${progress.completedVerses}절 처리됨`);
  console.log(`소요 시간: ${elapsed}분`);
  console.log(`결과 파일: ${RESULT_FILE}`);

  if (progress.errors.length > 0) {
    console.log(`\n오류 ${progress.errors.length}건:`);
    progress.errors.forEach(e => console.log(`  - ${e}`));
  }
}

updateBibleAll().catch(err => {
  console.error('오류 발생:', err);
  process.exit(1);
});
