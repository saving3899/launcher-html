/**
 * Anthropic (Claude) API 통신 모듈
 * 실리태번 방식 참고, 클라이언트 사이드에서 직접 호출
 */


const ANTHROPIC_API_BASE_URL = 'https://api.anthropic.com/v1';

/**
 * Anthropic API 호출
 * @param {object} options - API 옵션
 * @param {string} options.apiKey - API 키
 * @param {string} options.model - 모델 이름
 * @param {Array} options.messages - 메시지 배열 [{ role, content }]
 * @param {number} options.temperature - 온도 (0-1)
 * @param {number} options.maxTokens - 최대 토큰 수
 * @param {Array<string>} options.stopSequences - 정지 시퀀스
 * @param {boolean} options.stream - 스트리밍 여부
 * @param {AbortSignal} options.signal - 취소 신호
 * @param {Function} options.onChunk - 스트리밍 청크 콜백
 * @param {Array} options.system - 시스템 프롬프트 (선택사항)
 * @returns {Promise<string>} 응답 텍스트
 */
async function callAnthropic({
    apiKey,
    model,
    messages,
    temperature = 1.0,
    maxTokens = 2048,
    stopSequences = [],
    stream = false,
    signal = null,
    onChunk = null,
    system = null,
}) {
    if (!apiKey) {
        throw new Error('Anthropic API 키가 필요합니다.');
    }

    // 메시지 필터링 및 변환
    const filteredMessages = messages
        .filter(msg => msg && typeof msg === 'object')
        .map(msg => {
            // Anthropic 형식으로 변환
            if (typeof msg.content === 'string') {
                return {
                    role: msg.role,
                    content: msg.content,
                };
            }
            return msg;
        });

    const requestBody = {
        model: model,
        messages: filteredMessages,
        max_tokens: maxTokens,
        temperature: temperature,
        stream: stream,
    };

    // 선택적 필드 추가
    if (Array.isArray(stopSequences) && stopSequences.length > 0) {
        requestBody.stop_sequences = stopSequences;
    }

    if (Array.isArray(system) && system.length > 0) {
        requestBody.system = system;
    }

    // Anthropic은 기본적으로 세이프티 필터가 없음 (API 파라미터가 없음)

    const url = `${ANTHROPIC_API_BASE_URL}/messages`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': apiKey,
                'anthropic-dangerous-direct-browser-access': 'true', // 브라우저에서 직접 접근 허용
            },
            body: JSON.stringify(requestBody),
            signal: signal,
        });

        if (stream) {
            // 스트리밍 응답 처리 (Anthropic SSE 형식)
            return await parseStreamingResponse(response, 'anthropic', {
                onChunk: onChunk,
                onError: (error) => {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_API_10018', 'Anthropic 스트리밍 오류', error);
                    }
                    throw error;
                },
            });
        } else {
            // 비스트리밍 응답 처리
            if (!response.ok) {
                throw await handleApiError(response);
            }

            const data = await response.json();
            const content = data.content;
            
            if (!content || !Array.isArray(content) || content.length === 0) {
                throw new Error('Anthropic API가 빈 응답을 반환했습니다.');
            }

            // Anthropic은 content가 배열로 반환됨 (대부분 text 타입)
            const textContent = content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('');

            if (!textContent) {
                throw new Error('Anthropic API 응답에 텍스트가 없습니다.');
            }

            return textContent;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('요청이 취소되었습니다.');
        }
        throw error;
    }
}

