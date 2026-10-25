# Emergency ntfy — 작업 안내 (Claude Code용)

이 폴더만 작업합니다. `Desktop/Patient Acceptance Request`(Gmail · MacroDroid 버전)는 **별개 프로젝트**이니 수정하지 마세요.

## 구성

| 항목 | 위치 |
|---|---|
| GitHub (공개) | https://github.com/bandit1397/emergency-ntfy |
| Apps Script 프로젝트 "Emergency ntfy" | https://script.google.com/home/projects/1z6TcYcGqn4NmBVj3YbfTUzIyWQKtyG9zpFFMy1VVRwcRBAHsweiib3wA/edit |
| 웹앱 (/exec, 버전이 바뀌어도 같은 주소) | https://script.google.com/macros/s/AKfycbz-AdqsI0QU7ExhjOUC4_ULq8Das9895_s19KK65fi9wDRY7jpSte-YJr-u-ykqiJgvZg/exec |
| 파일 | `Code.gs`(서버) · `Index.html`(화면) · `appsscript.json` · `README.md`(사용자 안내) · `docs/qr-*.svg` |

- 스크립트 속성: `ACCESS_CODE`(사용자가 설정, 저장소에 쓰지 말 것) · `NTFY_PREFIX`(서버가 자동 생성한 토픽 접두어) · `WEBAPP_URL`(자동 저장)
- 토픽 = `NTFY_PREFIX` + `-1..4` (CONFIG.REGIONS 순서: 서울 · 인천 · 경기 · 기타)

## 알림 흐름

1. 경찰관 `createRequest` → 서버가 `ntfy` 내용(topic, title, message, priority 5, tags, click)을 돌려줌
2. **경찰관 브라우저가** `https://ntfy.sh/` 로 JSON 을 `Content-Type: text/plain` 으로 POST (사전 확인 없음, CORS 허용).
   Apps Script 서버(UrlFetchApp)는 ntfy.sh 에 접속할 수 없음 (Google 차단, 이전 프로젝트에서 확인)
3. 병원 화면 `ntfyTopics(code, regions)` → `ntfy://ntfy.sh/<topic>` 구독 버튼 (누르면 ntfy 앱에서 바로 구독됨)

## 시험으로 확인한 것 (2026-10-25, 갤럭시 A90 · 안드로이드 12 · ntfy 1.25.2)

- 화면 꺼짐 · **무음 모드**에서 약 1~2초 만에 도착, `USAGE_ALARM` 으로 재생 → 무음에서도 소리 남
- ntfy 설정 **"Keep alerting for highest priority"** 를 켜면 누를 때까지 계속 울림
- **소리는 알림 본문을 눌러야만 멈춤.** 알림 버튼(view action, clear:true)이나 밀어서 지우기로는 안 멈춤 → 버튼은 넣지 않기로 함.
  비상시: ntfy 강제 중지 후 ntfy 다시 열기 (`adb shell am force-stop io.heckel.ntfy` 후 앱 실행)
- 배포된 웹앱으로 처음부터 끝까지 통과 (병원 구독 버튼 → 경찰관 요청 1926-4HF → 휴대폰 알람 약 1.8초)

## 코드를 바꿀 때

1. 이 폴더에서 수정 → `node --check` 로 문법 확인 → 커밋 · `git push`
2. Apps Script 편집기 Code.gs / Index.html 에 반영 후 **저장** (편집기가 이전 커밋과 같은지 먼저 확인하고 덮어쓰기)
3. **배포 → 배포 관리 → 수정(연필) → 버전: 새 버전 → 배포** 는 사용자가 직접 함 (같은 /exec 주소 유지)
4. PC 에서 시험 알림을 보낼 때 한글은 **UTF-8 파일/파이썬으로** 보낼 것 (Git Bash 인자로 넣으면 한글이 깨짐)

## 남은 일 (2026-10-25 기준)

- 시험 끝나면 휴대폰 USB 디버깅 끄기

### 완료 (2026-10-25)

- `ACCESS_CODE` 설정됨 (사용자가 직접). 이제 경찰관 · 병원 모두 처음 접속할 때 코드를 넣어야 함
- 시험 휴대폰: 병원 이름 `SNU-test` → `서울대학교병원`, 코드 입력 완료
- ntfy 옛 시험 구독 삭제 → 남은 구독은 `par-4jypj546izg5tb57-1`(서울) 하나,
  ntfy 배터리 최적화 해제 (`adb shell dumpsys deviceidle whitelist +io.heckel.ntfy`)
- 위 정리 후 화면 꺼짐 상태에서 시험 알림 → 한글 제목 · 본문 정상 표시, `USAGE_ALARM` 으로 울림
- 웹앱이 버전 1(첫 커밋 코드)로 배포되어 있던 것을 발견 → 편집기는 이미 `ea3867d` 와 같았고, 사용자가 새 버전으로 배포함
  (배포된 /exec 화면에 새 문구 "🔕 알람 끄기" 있음 확인). 배포 여부는 ntfy 알림 문구로도 알 수 있음:
  옛 버전 = 제목 🚨🚨 · "눌러서 앱을 열고…", 최신 = 🚨 하나 · "이 알림을 누르면 알람이 멈춥니다"
- 알람음을 사이렌으로 변경 → 시험 알림에서 사이렌으로 울림 확인 (사용자가 "잘 울려요"라고 확인)
  - ntfy 의 '계속 울리기' 소리 = **"우선순위 최상"(`ntfy-max`) 알림 채널의 소리** (ntfy-android `NotificationService.getInsistentSound`)
  - 파이썬으로 직접 만든 사이렌 (`docs/sounds/`, 만드는 스크립트 `make_sirens.py`, README 에 설정 방법) `siren_wail.ogg`("Emergency Siren (wail)") · `siren_yelp.ogg`("Emergency Bell (fast)") 를
    휴대폰 `/sdcard/Notifications/` 에 넣음 → `ntfy-max` 채널 소리 = Emergency Siren (wail)
  - 채널 설정 바로 열기: `adb shell am start -a android.settings.CHANNEL_NOTIFICATION_SETTINGS --es android.provider.extra.APP_PACKAGE io.heckel.ntfy --es android.provider.extra.CHANNEL_ID ntfy-max`
