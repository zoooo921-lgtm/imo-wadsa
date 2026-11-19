# IMO Watch

IMO 및 기국(파나마, 라이베리아, 마셜제도) 공지를 모아 보여주는 PWA입니다. 한국선급(KR)과 해양수산부 소스는 URL 확인 후 추가합니다.

## 구조

- `sources.json` : 수집 대상 소스 목록 (enabled, link_contains 설정)
- `collector.py` : 표준 라이브러리만 쓰는 수집기. 결과를 `docs/data/items.json`에 저장
- `docs/` : PWA 프론트엔드 (GitHub Pages로 배포)
- `.github/workflows/collect.yml` : 3시간마다 수집 후 커밋

## 실행

```bash
python3 collector.py          # 수집
python3 -m http.server -d docs 8000   # 로컬에서 확인 (http://localhost:8000)
```

## 배포

1. GitHub 저장소에 올리고 Settings > Pages에서 `docs/` 폴더를 배포하도록 설정
2. Actions 탭에서 `collect-imo-updates`를 수동 실행해 첫 데이터 생성
3. 휴대폰 Chrome(안드로이드)은 메뉴의 "홈 화면에 추가", 아이폰 Safari는 공유 버튼의 "홈 화면에 추가"

## 알려진 한계 (확인 필요)

- 소스 페이지가 JavaScript로 목록을 그리면 수집이 0건일 수 있습니다. `collector.py` 실행 후 오류/신규 건수를 확인하세요.
- 기국 공지 PDF 본문은 아직 요약하지 않고 제목과 링크만 저장합니다.
- 우선순위(HIGH)는 제목의 키워드(SOLAS, MARPOL 등)로만 판단합니다. 본문 기반 판단은 2단계입니다.
- 앱이 닫혀 있을 때의 푸시 알림은 Web Push 서버가 필요해서 2단계입니다. 현재는 앱을 열었을 때만 알림이 뜹니다.
- 아이폰은 홈 화면에 추가한 PWA에서만 알림이 동작하며, iOS 16.4 이상이 필요합니다.
- 각 사이트의 이용 약관을 확인하고, 원문 전체를 복제하지 않도록 제목과 링크만 표시합니다.

## 다음 단계 (2단계)

1. 한국선급, 해양수산부 URL 확인 후 `sources.json` 활성화
2. 공지 PDF 텍스트 추출과 한국어 요약 추가
3. Web Push 구독 저장과 발송 (고우선순위 항목만)
4. 본문 기반 우선순위 판단 (SOLAS, MARPOL 조항 번호 인식)
