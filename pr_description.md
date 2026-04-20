🎯 What:
iOS 배포 시 발생하는 AppIcon 투명도(Alpha Channel) 오류를 해결합니다.

🛠 How:
Github Action release workflow(`.github/workflows/release.yml`)의 `build-ios` 작업에서 `tauri icon`으로 아이콘을 생성한 직후, `imagemagick`의 `mogrify` 명령어를 사용하여 모든 iOS 아이콘에서 Alpha Channel을 제거하는 단계를 추가했습니다.

✨ Result:
이제 App Store Connect 업로드 시 투명도(Alpha Channel) 관련 에러(`Invalid large app icon. The large app icon in the asset catalog in “Task Manager.app” can’t be transparent or contain an alpha channel.`)가 발생하지 않으며, iOS 앱 배포가 정상적으로 이루어집니다.
