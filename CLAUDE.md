# Emergency ntfy — 작업 안내 (Claude Code용)

이 폴더만 작업합니다. `Desktop/Patient Acceptance Request`(Gmail · MacroDroid 버전)는 **별개 프로젝트**이니 수정하지 마세요.

## 구성

| 항목 | 위치 |
|---|---|
| GitHub (공개) | https://github.com/bandit1397/emergency-ntfy |
| Apps Script 프로젝트 "Emergency ntfy" | https://script.google.com/home/projects/1z6TcYcGqn4NmBVj3YbfTUzIyWQKtyG9zpFFMy1VVRwcRBAHsweiib3wA/edit |
| 웹앱 (/exec, 버전이 바뀌어도 같은 주소) | https://script.google.com/macros/s/AKfycbz-AdqsI0QU7ExhjOUC4_ULq8Das9895_s19KK65fi9wDRY7jpSte-YJr-u-ykqiJgvZg/exec |
| 파일 | `Code.gs`(서버) · `Index.html`(화면) · `appsscript.json` · `README.md`(사용자 안내) · `docs/qr-*.svg` |
| 휴대폰 빠른 설정 (웹앱과 별개) | `phone-setup/` — 아래 **phone-setup** 참고 |

- 스크립트 속성: `ACCESS_CODE`(사용자가 설정, 저장소에 쓰지 말 것) · `NTFY_PREFIX`(서버가 자동 생성한 토픽 접두어) · `WEBAPP_URL`(자동 저장) · `NTFY_SLOT_1..4`(최근 3개 남기기용 칸 번호, 자동)
- 토픽 = `NTFY_PREFIX` + `-1..4` (CONFIG.REGIONS 순서: 서울 · 인천 · 경기 · 기타)

## 알림 흐름

1. 경찰관 `createRequest` → 서버가 `ntfy` 내용(topic, title, message, priority 5, tags, sequence_id, actions[view '환자 수용 요청 열기'] — click 없음)을 돌려줌
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

## phone-setup (2026-11-14 추가)

병원 휴대폰 ntfy 설정을 **ntfy 백업 파일 복원** 한 번으로 줄이는 도구. 웹앱(`Code.gs` · `Index.html`)은 건드리지 않음.

| 파일 | 내용 |
|---|---|
| `make-ntfy-restore.html` | PC 에서 더블클릭. 토픽 이름(`par-…-N`, 주소째도 됨) + 지역 체크 → `ntfy-병원설정-<지역>.json` 다운로드. 오프라인, 외부 전송 없음 |
| `README.md` | 관리자(파일 만들기) · 병원 휴대폰(설치 → 배터리 → 파일에서 복원 → 웹앱 등록) 순서 |
| `병원휴대폰-설정-절차.pdf` | 전체 절차 A4 6쪽 (1 흐름 · 2 토픽 찾기 · 3 파일 만들기 · 4 보내기 · 5 기본 설정 · 6 복원 · 7 웹앱 등록 · 8 사이렌 · 9 시험 · 10 알람 끄기 · 11 매일 점검 · 12 주의) |
| `pdf-source.html` | 위 PDF 의 원본. 고친 뒤 Chrome 으로 다시 만들기 (아래) |
| `.gitignore` | `*.json` — 복원 파일에는 토픽 이름이 들어 있으므로 **공개 저장소에 올리지 않음** |

- 백업 형식 (ntfy-android v1.25.2 `backup/Backuper.kt` 확인): `magic: "ntfy2586"`(이것만 검사) · `version: 1` ·
  `settings: null`(앱 전체 설정은 안 바꿈) · `subscriptions[]` 에 `baseUrl https://ntfy.sh` · `topic` · **`instant: true`** · **`insistent: 1`** ·
  `dedicatedChannels: false`(→ `ntfy-max` 채널 소리 = 사이렌 설정 그대로) · `displayName "🚑 <지역> 환자 수용 요청"` · `id` 는 `Date.now()*10+i`
- 계속 울리기: `NotificationService.kt` — 우선순위 5 이고 (전체 Keep alerting **또는** 구독 `insistent == 1`) → 전체 설정을 안 켜도 됨
- **같은 토픽이 이미 구독돼 있으면** Room `@Insert`(ABORT) 실패 → 그 구독만 건너뜀. 기존 휴대폰은 구독 삭제 후 복원
- 복원 파일로 **안 되는 것**: 배터리 최적화 해제 · 알림 소리(사이렌) · 저장공간 권한 (안드로이드가 다른 앱 설정 변경을 막음) → 사람이 직접 (PDF 8번)
- 사이렌 (PDF 8번): `…/raw/main/docs/sounds/siren_wail.ogg` 다운로드 → 내 파일로 `Notifications` 폴더에 이동 →
  ntfy 알림 **우선순위 최상** → 소리 → 저장공간 권한 (안드로이드 13+ 은 "음악 및 오디오")
- 새로 설치해 시험한 휴대폰: 복원 후 알림은 왔지만 **기본 소리** → 사이렌은 위처럼 따로 설정해야 함 (사용자 확인, 2026-11-14)
- PDF 다시 만들기 (PowerShell, 출력 경로는 `phone-setup/` 안):
  `& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --no-pdf-header-footer "--print-to-pdf=<저장소>\phone-setup\병원휴대폰-설정-절차.pdf" "file:///<저장소>/phone-setup/pdf-source.html"`
- 이 PC 는 git `user.name/email` 이 설정돼 있지 않음 → 커밋할 때 `git -c user.name=bandit1397 -c user.email=<기존 커밋과 같은 이메일> commit …`

## 남은 일 (2026-10-25 기준)

- 시험 끝나면 휴대폰 USB 디버깅 끄기 (A90, 노트 FE 둘 다)

### 알림을 눌러도 안 멈추던 문제 (2026-10-25)

- ntfy-android 소스: 계속 울리기는 **DetailActivity(토픽 화면) onResume** 에서 `mediaPlayer.stop()` 으로 멈춤.
  알림에 `click` 이 있으면 알림을 눌렀을 때 그 URL 만 열리고(ACTION_VIEW) DetailActivity 가 안 열려 **계속 울림**.
  실제로 웹앱 요청 알림을 눌러도 안 멈췄고, ntfy 앱 → 구독한 주제를 눌러야 멈춤 (A90 · 노트 FE 둘 다)
- 해결: `click` 제거, 웹앱 주소는 본문 `앱 열기: <url>` 로 → 노트 FE 에서 알림을 누르니 토픽 화면이 열리며 알람 멈춤,
  그 화면의 링크를 누르니 웹앱 열림 (임시 토픽으로 확인)
- 웹앱에서도 알람 끄기 (사용자 요청: 배너 · 수용 가능/불가 · 알림 세 곳 모두에서 끄기):
  Android 에서 배너/응답 버튼을 누르면 그 순간 `ntfy://ntfy.sh/<topic>` 을 `<a target=_blank>` 로 열어 토픽 화면을 띄움
  (구독 버튼과 같은 방식). 요청마다 한 번만 (localStorage `par_ntfy_quiet`). 배너는 웹앱 소리도 끔 (새 요청이 오면 다시 울림)
  → 배포 후 노트 FE 에서 요청 2213-EP7 때 사용자가 배너를 누르니 소리 꺼짐 (Chrome 위에 ntfy DetailActivity 열림 확인).
  수용 가능/불가 버튼은 같은 함수(stopNtfyAlarm)를 쓰지만 따로 시험하지는 않음
- **알림 본문 주소 → 버튼으로 (사용자 요청)**: 본문의 '앱 열기: <url>' 대신 ntfy action `view` '환자 수용 요청 열기'(clear).
  알림 본문 → ntfy 화면(알람 멈춤) → 화면 카드의 버튼 → 웹앱 (A90 에서 버튼으로 삼성 인터넷 열림 확인). `?from=ntfy` 는 없앰
  (알림의 버튼으로 바로 웹앱을 열면 알람이 계속 울리므로, 웹앱 배너/응답 버튼으로 끌 수 있게).
- **알람이 안 멈춘 경우 (A90, 2254-SLP)**: `mediaPlayer.stop()` 은 DetailActivity `loadView()`(onCreate) 에만 있음.
  ntfy 토픽 화면이 맨 앞인 채로 잠겼다가 풀면 그 화면이 onResume → 알림만 지우고 알람은 계속. → 사용자 안내로 대응
- 웹앱(서버)도 지역별 최근 3건만: `createRequest` 에서 같은 지역의 오래된 요청을 밀어내서 삭제 (사용자 요청, 응답 대기 10건이 쌓였었음)
- 최근 3개만 남기기: 알림에 `sequence_id` = 지역별 `slot-1..3` 을 돌려 씀 (스크립트 속성 `NTFY_SLOT_<지역번호>`).
  ntfy 앱은 같은 sequence_id 의 새 알림이 오면 이전 것을 지움 (새 알림은 그대로 울림). 노트 FE 에서 4개 보내 3개 남음 확인.
  이 기능 이전에 쌓인 알림은 그대로 남음 (앱에서 직접 지우거나 1달 뒤 자동 삭제)
- **즉시 전달(instant) 필수**: 22:07 · 22:08 요청이 노트 FE 에 FCM 으로 안 옴 (서버에는 있음). 구독 설정 → 즉시 전달 켜자
  JSON stream 연결(`/json?since=<마지막 id>`)로 못 받은 2건이 3초 만에 들어와 울림. 노트 FE · A90 모두 켬 (A90 은 Wi-Fi 가 꺼져 있어 켠 뒤 CONNECTED 확인).
  2건이 동시에 오면 두 번째 `Media player: Failed to play insistent alarm` (IllegalStateException) — 첫 번째가 울리므로 무해
- ntfy.sh → 휴대폰 FCM 전달이 가끔 수십 초~몇 분 늦을 때가 있었음 (시험 알림을 많이 보낸 뒤)

### 두 번째 시험 휴대폰: 갤럭시 노트 FE (SM-N935S · 안드로이드 9 · ntfy 1.25.2), 2026-10-25

- 소리가 안 나던 원인: ntfy 구독 없음 + "Keep alerting" 꺼짐
- 서울 토픽 구독, Keep alerting 켬, `ntfy-max` 소리 = Emergency Siren (wail), 저장공간 권한 허용
  → 화면 꺼짐에서 시험 알림 → `USAGE_ALARM` 으로 계속 울림 확인

### 완료 (2026-10-25)

- `ACCESS_CODE` 설정됨 (사용자가 직접). 이제 경찰관 · 병원 모두 처음 접속할 때 코드를 넣어야 함
- 시험 휴대폰: 병원 이름 `SNU-test` → `서울대학교병원`, 코드 입력 완료
- ntfy 옛 시험 구독 삭제 → 남은 구독은 서울 토픽(`NTFY_PREFIX-1`) 하나,
  ntfy 배터리 최적화 해제 (`adb shell dumpsys deviceidle whitelist +io.heckel.ntfy`)
- 위 정리 후 화면 꺼짐 상태에서 시험 알림 → 한글 제목 · 본문 정상 표시, `USAGE_ALARM` 으로 울림
- 웹앱이 버전 1(첫 커밋 코드)로 배포되어 있던 것을 발견 → 편집기는 이미 `ea3867d` 와 같았고, 사용자가 새 버전으로 배포함
  (배포된 /exec 화면에 새 문구 "🔕 알람 끄기" 있음 확인). 배포 여부는 ntfy 알림 문구로도 알 수 있음:
  옛 버전 = 제목 🚨🚨 · "눌러서 앱을 열고…", 최신 = 🚨 하나 · "이 알림을 누르면 알람이 멈춥니다"
- 알람음을 사이렌으로 변경 → 시험 알림에서 사이렌으로 울림 확인 (사용자가 "잘 울려요"라고 확인)
  - ntfy 의 '계속 울리기' 소리 = **"우선순위 최상"(`ntfy-max`) 알림 채널의 소리** (ntfy-android `NotificationService.getInsistentSound`)
  - 파이썬으로 직접 만든 사이렌 (`docs/sounds/`, 만드는 스크립트 `make_sirens.py`, README 에 설정 방법) `siren_wail.ogg`("Emergency Siren (wail)") · `siren_yelp.ogg`("Emergency Bell (fast)") 를
    휴대폰 `/sdcard/Notifications/` 에 넣음 → `ntfy-max` 채널 소리 = Emergency Siren (wail)
  - **주의**: 채널 소리를 휴대폰 저장공간 파일로 바꾸면 ntfy 에 `READ_EXTERNAL_STORAGE` 가 있어야 함. 없으면
    `Media player: Failed to play insistent alarm` (Permission Denial) → 알림 소리 1번만, 계속 울리기 안 됨.
    `adb shell pm grant io.heckel.ntfy android.permission.READ_EXTERNAL_STORAGE` 로 해결 (노트 FE · 안드로이드 9 에서 확인)
  - 채널 설정 바로 열기: `adb shell am start -a android.settings.CHANNEL_NOTIFICATION_SETTINGS --es android.provider.extra.APP_PACKAGE io.heckel.ntfy --es android.provider.extra.CHANNEL_ID ntfy-max`
