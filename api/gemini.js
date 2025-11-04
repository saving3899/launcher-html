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
 * @param {string} options.reasoningEffort - Reasoning effort ('auto', 'min', 'low', 'medium', 'high', 'max')
 * @param {boolean} options.includeReasoning - Reasoning thoughts 포함 여부
 * @param {boolean} options.enableWebSearch - 웹 검색 활성화
 * @param {boolean} options.requestImages - 이미지 요청 활성화
 * @param {boolean} options.useSysprompt - 시스템 프롬프트 사용
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
    reasoningEffort = 'auto',
    includeReasoning = false,
    enableWebSearch = false,
    requestImages = false,
    useSysprompt = false,
    seed = undefined, // seed 파라미터 추가
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
    
    // seed 파라미터 추가 (Gemini는 seed를 지원함, seed가 정의되어 있고 >= 0일 때만)
    if (seed !== undefined && seed >= 0) {
        generationConfig.seed = seed;
    }

    // 선택적 필드 추가
    if (Array.isArray(stopSequences) && stopSequences.length > 0) {
        generationConfig.stopSequences = stopSequences;
    }

    // Thinking Config 지원 (Gemini 2.5 Flash/Pro)
    const isThinkingConfigModel = /^gemini-2.5-(flash|pro)/.test(model) && !/-image(-preview)?$/.test(model);
    if (isThinkingConfigModel && window.tokenOptimization) {
        const thinkingBudget = window.tokenOptimization.calculateGoogleBudgetTokens(
            maxTokens,
            reasoningEffort,
            model
        );
        
        if (Number.isInteger(thinkingBudget) && thinkingBudget >= 0) {
            generationConfig.thinkingConfig = {
                includeThoughts: includeReasoning,
                thinkingBudget: thinkingBudget > 0 ? thinkingBudget : undefined,
            };
            
            // thinkingBudget이 0이고 includeThoughts가 true면 false로 변경
            if (thinkingBudget === 0 && includeReasoning) {
                generationConfig.thinkingConfig.includeThoughts = false;
            }
        }
    }

    const requestBody = {
        contents: contents,
        generationConfig: generationConfig,
        safetySettings: GEMINI_SAFETY, // 세이프티 완전 비활성화
    };

    // 실리태번과 동일: 이미지 생성 모델 및 request_images 처리 (398-401번 라인)
    const imageGenerationModels = [
        'gemini-2.0-flash-exp',
        'gemini-2.0-flash-exp-image-generation',
        'gemini-2.0-flash-preview-image-generation',
        'gemini-2.5-flash-image-preview',
        'gemini-2.5-flash-image',
    ];
    const enableImageModality = requestImages && imageGenerationModels.includes(model);
    if (enableImageModality) {
        generationConfig.responseModalities = ['text', 'image'];
    }

    // 실리태번과 동일: use_sysprompt 처리 (403번 라인)
    // useSysprompt가 true이고 이미지 생성 모드가 아니면 systemInstruction 사용
    const useSystemPrompt = !enableImageModality && useSysprompt;
    
    // 실리태번과 동일: tools 배열 추가 (409-427번 라인)
    const tools = [];
    const isGemma = model.includes('gemma');
    const isLearnLM = model.includes('learnlm');
    const noSearchModels = [
        'gemini-2.0-flash-lite',
        'gemini-2.0-flash-lite-001',
        'gemini-2.0-flash-lite-preview-02-05',
        'gemini-robotics-er-1.5-preview',
    ];
    
    // 웹 검색 활성화 (409-410번 라인)
    if (enableWebSearch && !enableImageModality && !isGemma && !isLearnLM && !noSearchModels.includes(model)) {
        tools.push({ google_search: {} });
    }
    
    // tools가 있으면 requestBody에 추가
    if (tools.length > 0) {
        requestBody.tools = tools;
    }

    // 시스템 인스트럭션 추가 (useSystemPrompt가 true일 때만)
    if (useSystemPrompt && systemInstruction) {
        if (typeof systemInstruction === 'string') {
            requestBody.systemInstruction = {
                parts: [{ text: systemInstruction }],
            };
        } else {
            requestBody.systemInstruction = systemInstruction;
        }
    } else if (!useSystemPrompt && systemInstruction) {
        // useSystemPrompt가 false면 시스템 메시지를 contents에 포함 (실리태번과 동일)
        // convertMessagesToGeminiFormat에서 이미 처리될 수 있지만, 여기서 확인
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

