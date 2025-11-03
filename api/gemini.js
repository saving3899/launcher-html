/**
 * Google Gemini API 통신 모듈
 * 실리태번 방식 참고, 클라이언트 사이드에서 직접 호출
 */


const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com';

/**
 * Google Gemini API 호출
 * @param {object} options - API 옵션
 * @param {string} options.apiKey - API 키
 * @param {string} options.model - 모델 이름
 * @param {Array} options.messages - 메시지 배열 [{ role, content }]
 * @param {number} options.temperature - 온도 (0-2)
 * @param {number} options.maxTokens - 최대 토큰 수
 * @param {Array<string>} options.stopSequences - 정지 시퀀스
 * @param {boolean} options.stream - 스트리밍 여부
 * @param {AbortSignal} options.signal - 취소 신호
 * @param {Function} options.onChunk - 스트리밍 청크 콜백
 * @param {object} options.systemInstruction - 시스템 인스트럭션 (선택사항)
 * @returns {Promise<string>} 응답 텍스트
 */
async function callGemini({
    apiKey,
    model,
    messages,
    temperature = 1.0,
    maxTokens = 2048,
    stopSequences = [],
    stream = false,
    signal = null,
    onChunk = null,
    systemInstruction = null,
}) {
    if (!apiKey) {
        throw new Error('Google Gemini API 키가 필요합니다.');
    }

    // 메시지를 Gemini 형식으로 변환
    const contents = convertMessagesToGeminiFormat(messages);

    const generationConfig = {
        temperature: temperature,
        maxOutputTokens: maxTokens,
        candidateCount: 1,
    };

    // 선택적 필드 추가
    if (Array.isArray(stopSequences) && stopSequences.length > 0) {
        generationConfig.stopSequences = stopSequences;
    }

    const requestBody = {
        contents: contents,
        generationConfig: generationConfig,
        safetySettings: GEMINI_SAFETY, // 세이프티 완전 비활성화
    };

    // 시스템 인스트럭션 추가
    if (systemInstruction) {
        if (typeof systemInstruction === 'string') {
            requestBody.systemInstruction = {
                parts: [{ text: systemInstruction }],
            };
        } else {
            requestBody.systemInstruction = systemInstruction;
        }
    }

    const apiVersion = 'v1beta';
    const responseType = stream ? 'streamGenerateContent' : 'generateContent';
    const url = `${GEMINI_API_BASE_URL}/${apiVersion}/models/${model}:${responseType}?key=${apiKey}${stream ? '&alt=sse' : ''}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: signal,
        });

        if (stream) {
            // 스트리밍 응답 처리 (Gemini SSE 형식)
            return await parseStreamingResponse(response, 'gemini', {
                onChunk: onChunk,
                onError: (error) => {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_API_10019', 'Gemini 스트리밍 오류', error);
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
            const candidates = data.candidates;
            
            if (!candidates || candidates.length === 0) {
                let errorMessage = 'Gemini API가 후보를 반환하지 않았습니다.';
                if (data.promptFeedback?.blockReason) {
                    errorMessage += ` 프롬프트가 차단되었습니다: ${data.promptFeedback.blockReason}`;
                }
                throw new Error(errorMessage);
            }

            const candidate = candidates[0];
            const content = candidate.content;
            
            if (!content || !content.parts) {
                throw new Error('Gemini API 응답에 내용이 없습니다.');
            }

            // parts에서 텍스트 추출
            const textParts = content.parts
                .filter(part => part.text && !part.thought) // thought 제외
                .map(part => part.text);

            if (textParts.length === 0) {
                throw new Error('Gemini API 응답에 텍스트가 없습니다.');
            }

            return textParts.join('\n\n');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('요청이 취소되었습니다.');
        }
        throw error;
    }
}

/**
 * 메시지를 Gemini 형식으로 변환
 * @param {Array} messages - 메시지 배열 [{ role, content }]
 * @returns {Array} Gemini contents 형식
 */
function convertMessagesToGeminiFormat(messages) {
    const contents = [];
    
    for (const msg of messages) {
        if (!msg || typeof msg !== 'object') continue;
        
        const role = msg.role === 'assistant' ? 'model' : 'user';
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        
        contents.push({
            role: role,
            parts: [{ text: content }],
        });
    }
    
    return contents;
}

