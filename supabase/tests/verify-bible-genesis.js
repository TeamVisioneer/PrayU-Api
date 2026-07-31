/**
 * 창세기 성경 데이터 검증 스크립트
 *
 * Bible 테이블의 sentence 내용을 goodtvbible API의 정답 데이터와 비교합니다.
 *
 * 사용법: node supabase/tests/verify-bible-genesis.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPA_PROJECT_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPA_PROJECT_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('환경변수 SUPA_PROJECT_URL, SUPA_PROJECT_SERVICE_ROLE_KEY가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const GENESIS_CHAPTERS = 50; // 창세기는 50장
const BIBLE_CODE = 1; // 창세기 bible_code

/**
 * goodtvbible API에서 특정 장의 성경 데이터를 가져옵니다.
 */
async function fetchChapterFromAPI(chapter) {
  const url = `https://goodtvbible.goodtv.co.kr/api/onlinebible/bibleread/read-all?version1=0&version2=&version3=&bible_code=${BIBLE_CODE}&jang=${chapter}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  const json = await response.json();
  const verses = json.data?.data?.version1?.content || [];

  return verses.map(v => ({
    chapter,
    paragraph: v.jul,
    text: v.text
  }));
}

/**
 * Supabase에서 특정 장의 성경 데이터를 가져옵니다.
 */
async function fetchChapterFromDB(bibleCode, chapter) {
  const { data, error } = await supabase
    .from('bible')
    .select('chapter, paragraph, sentence')
    .eq('book', bibleCode)
    .eq('chapter', chapter)
    .order('paragraph', { ascending: true });

  if (error) {
    throw new Error(`DB 조회 실패: ${error.message}`);
  }

  return data;
}

/**
 * 텍스트 정규화 (비교를 위해 공백/특수문자 제거)
 */
function normalizeText(text) {
  if (!text) return '';
  // ○ 기호 제거 (문단 시작 기호)
  return text.replace(/^○/, '').replace(/\s+/g, ' ').trim();
}

/**
 * DB 텍스트에서 소제목 제거 (예: <천지 창조>)
 */
function removeSubtitle(text) {
  if (!text) return '';
  return text.replace(/^<[^>]+>\s*/, '').trim();
}

/**
 * 소제목이 포함되어 있는지 확인
 */
function hasSubtitle(text) {
  if (!text) return false;
  return /^<[^>]+>/.test(text);
}

/**
 * 메인 검증 함수
 */
async function verifyGenesis() {
  console.log('창세기 성경 데이터 검증을 시작합니다...\n');

  const results = [];
  let matchCount = 0;
  let mismatchCount = 0;
  let missingCount = 0;
  let subtitleCount = 0;
  let totalDbVerses = 0;
  let totalApiVerses = 0;

  console.log('장별 데이터 조회 및 비교 중...');

  for (let chapter = 1; chapter <= GENESIS_CHAPTERS; chapter++) {
    try {
      // DB와 API에서 동시에 해당 장 데이터 가져오기
      const [dbVerses, apiVerses] = await Promise.all([
        fetchChapterFromDB(BIBLE_CODE, chapter),
        fetchChapterFromAPI(chapter)
      ]);

      totalDbVerses += dbVerses.length;
      totalApiVerses += apiVerses.length;

      // DB 데이터를 맵으로 변환 (빠른 조회를 위해)
      const dbMap = new Map();
      for (const row of dbVerses) {
        dbMap.set(row.paragraph, row.sentence);
      }

      // 비교 수행
      for (const apiVerse of apiVerses) {
        const dbSentence = dbMap.get(apiVerse.paragraph);
        const apiText = normalizeText(apiVerse.text);
        const dbText = normalizeText(dbSentence);
        const dbTextWithoutSubtitle = normalizeText(removeSubtitle(dbSentence));

        let isMatch;
        if (!dbSentence) {
          isMatch = 'DB에 없음';
          missingCount++;
        } else if (apiText === dbText) {
          isMatch = 'O';
          matchCount++;
        } else if (hasSubtitle(dbSentence) && apiText === dbTextWithoutSubtitle) {
          // 소제목만 다른 경우
          isMatch = '△';
          subtitleCount++;
        } else {
          isMatch = 'X';
          mismatchCount++;
        }

        results.push({
          long_label: '창세기',
          paragraph: `${chapter}장 ${apiVerse.paragraph}절`,
          match: isMatch,
          dbContent: dbSentence || '',
          apiContent: apiVerse.text
        });
      }

      process.stdout.write(`   - ${chapter}장 완료 (DB: ${dbVerses.length}절, API: ${apiVerses.length}절)\r`);
    } catch (err) {
      console.error(`\n   ! ${chapter}장 조회 실패: ${err.message}`);
    }

    // API 부하 방지를 위한 딜레이
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n   - DB 총 ${totalDbVerses}개 구절, API 총 ${totalApiVerses}개 구절 조회됨`);

  // 4. CSV 파일 생성
  console.log('4. CSV 파일 생성 중...');
  const csvHeader = 'long_label,paragraph,일치 여부,기존 컨텐츠,정답 컨텐츠';
  const csvRows = results.map(r => {
    // CSV에서 쉼표와 줄바꿈 처리
    const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;
    return `${escape(r.long_label)},${escape(r.paragraph)},${escape(r.match)},${escape(r.dbContent)},${escape(r.apiContent)}`;
  });

  const csvContent = [csvHeader, ...csvRows].join('\n');
  const outputPath = path.join(__dirname, 'genesis-verification-result.csv');
  fs.writeFileSync(outputPath, '\ufeff' + csvContent, 'utf8'); // BOM 추가 (Excel 한글 호환)

  // 5. 결과 요약
  console.log('\n========== 검증 결과 요약 ==========');
  console.log(`총 검증 구절: ${totalApiVerses}개`);
  console.log(`일치 (O): ${matchCount}개`);
  console.log(`소제목 차이 (△): ${subtitleCount}개`);
  console.log(`불일치 (X): ${mismatchCount}개`);
  console.log(`DB에 없음: ${missingCount}개`);
  console.log(`\n결과 파일: ${outputPath}`);

  // 불일치 샘플 출력 (최대 5개)
  if (mismatchCount > 0) {
    console.log('\n========== 불일치 샘플 (최대 5개) ==========');
    const mismatches = results.filter(r => r.match === 'X').slice(0, 5);
    for (const m of mismatches) {
      console.log(`\n[${m.paragraph}]`);
      console.log(`  기존: ${m.dbContent.substring(0, 50)}...`);
      console.log(`  정답: ${m.apiContent.substring(0, 50)}...`);
    }
  }
}

verifyGenesis().catch(err => {
  console.error('오류 발생:', err);
  process.exit(1);
});
