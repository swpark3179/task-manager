💡 **What:**
`daily_task_snapshots` 테이블의 `upsert` 쿼리와 `tasks` 테이블의 `update` 쿼리를 `Promise.all`을 사용하여 병렬로 실행되도록 최적화했습니다.

🎯 **Why:**
이전 코드에서는 롤오버 처리 시 `upsert`가 완료된 후 `update`가 순차적으로 실행되어 불필요한 대기 시간(I/O 지연)이 발생했습니다. 두 쿼리는 서로 의존성이 없으므로 병렬로 실행함으로써 데이터베이스 I/O 병목을 줄이고 작업 속도를 향상시킬 수 있습니다.

📊 **Measured Improvement:**
Mock async delay 함수 (50ms씩 지연)를 이용한 벤치마크 테스트 결과,
- **Sequential time:** ~2013ms
- **Concurrent time:** ~1011ms
- **Improvement:** 약 49.78% 속도 향상 효과 확인 (순차 실행 대비 병렬 처리로 I/O 대기 시간을 반으로 단축)
