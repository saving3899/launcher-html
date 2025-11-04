/**
 * 백그라운드 작업 처리용 Web Worker
 * 호스팅 환경에서 백그라운드 탭에서도 실행되도록 보장
 */

// Worker에서 받은 메시지 처리
self.onmessage = async function(e) {
    const { action, data } = e.data;
    
    try {
        switch (action) {
            case 'saveChat':
                // 채팅 저장 작업 (메인 스레드에서 실행)
                // Worker는 메인 스레드에 작업 요청만 전달
                self.postMessage({
                    action: 'saveChatRequest',
                    data: data
                });
                break;
                
            case 'log':
                // 디버깅용 로그 (백그라운드에서도 출력)
                console.log('[BackgroundWorker]', data.message, data.data || '');
                break;
                
            case 'ping':
                // 연결 확인
                self.postMessage({
                    action: 'pong',
                    timestamp: Date.now()
                });
                break;
        }
    } catch (error) {
        self.postMessage({
            action: 'error',
            error: error.message,
            originalAction: action
        });
    }
};

// 주기적으로 핑 전송 (백그라운드에서도 실행 중임을 확인)
setInterval(() => {
    self.postMessage({
        action: 'heartbeat',
        timestamp: Date.now()
    });
}, 1000);


