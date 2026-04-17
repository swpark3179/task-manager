import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>이메일 인증 완료 - 업무관리</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #eceff4; /* Nord6 */
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #2e3440; /* Nord0 */
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .card {
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            padding: 40px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            animation: slideUp 0.5s ease-out;
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .icon {
            width: 64px;
            height: 64px;
            background-color: #a3be8c; /* Nord14 (Green) */
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            color: white;
        }
        h1 {
            color: #3b4252; /* Nord1 */
            margin: 0 0 16px;
            font-size: 24px;
        }
        p {
            color: #4c566a; /* Nord3 */
            margin: 0 0 32px;
            line-height: 1.6;
        }
        .btn {
            display: inline-block;
            background-color: #5e81ac; /* Nord10 */
            color: #ffffff;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 600;
            transition: background-color 0.2s;
            width: 100%;
            box-sizing: border-box;
            border: none;
            cursor: pointer;
        }
        .btn:hover {
            background-color: #81a1c1; /* Nord9 */
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </div>
        <h1>인증이 완료되었습니다!</h1>
        <p>이메일 인증이 성공적으로 처리되었습니다.<br>이제 업무관리 앱으로 돌아가서 로그인을 진행해 주세요.</p>
        <button class="btn" onclick="window.close()">창 닫기</button>
    </div>
</body>
</html>
`;

Deno.serve(async (req: Request) => {
  return new Response(HTML_CONTENT, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Connection': 'keep-alive'
    }
  });
});
