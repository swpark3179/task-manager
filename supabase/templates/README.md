# 이메일 인증 템플릿 및 리다이렉트 적용 안내

이 디렉토리의 파일들은 회원가입 후 발송되는 "이메일 인증(Confirm email)" 기능 개선을 위해 작성되었습니다. 앱 외부(브라우저)에서 사용자가 확인 메일의 링크를 클릭했을 때 보다 예쁘고 친절한 환경을 제공하도록 구성했습니다.

**해당 변경사항은 코드 커밋만으로는 프로젝트에 적용되지 않으며, 사용자님께서 직접 Supabase 대시보드에서 몇 가지 설정을 해주셔야 합니다.**

## 1. 이메일 템플릿(제목/본문) 변경

1. **Supabase 대시보드**에 접속합니다. (https://supabase.com/dashboard)
2. 해당 프로젝트 선택 후, 왼쪽 메뉴에서 **Authentication** > **Email Templates**으로 이동합니다.
3. **Confirm signup** 탭을 엽니다.
4. 아래와 같이 설정을 변경합니다:
   - **Subject (제목):** `업무관리 - Confirm Your Signup`
   - **Message (본문):** `supabase/templates/email-confirm.html` 파일의 전체 내용을 복사하여 붙여넣습니다. (이때 소스코드 보기 모드인 `< >` 버튼을 눌러 HTML 모드로 붙여넣으세요)
5. 저장을 누릅니다.

## 2. 인증 완료 리다이렉트 URL 설정

사용자가 메일 본문의 인증 버튼을 클릭하여 성공적으로 이메일이 확인되면, 텅 빈 화면 대신 방금 배포한 멋진 "승인 완료" 안내 페이지를 보여주도록 설정합니다.

1. 동일한 **Authentication** 메뉴에서 **URL Configuration** 항목으로 이동합니다.
2. **Site URL** (또는 Redirect URLs 중 이메일 확인 기본 이동 주소) 항목을 아래 주소로 변경/추가합니다.

   ```text
   https://jqyqaopuzpxwleqrhvfs.supabase.co/functions/v1/auth-success
   ```

   *(이 주소는 방금 배포된 Edge Function의 퍼블릭 URL입니다.)*
3. 설정 후 저장을 누릅니다.

이제부터 회원가입 시 예쁜 Nord 테마의 메일이 발송되며, 승인 버튼 클릭 시 브라우저에 인증 완료 페이지가 나타납니다.
