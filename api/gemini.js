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
    // API 키 검증 (빈 문자열 체크만, 실제 유효성은 API 호출로 확인)
    // 실리태번과 동일: 클라이언트 사이드에서 복잡한 검증을 하지 않음
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
        throw new Error('Google Gemini API 키가 필요합니다.');
    }
    
    const trimmedApiKey = apiKey.trim();

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
    // API 키를 URL 인코딩하여 안전하게 처리
    const encodedApiKey = encodeURIComponent(trimmedApiKey);
    const url = `${GEMINI_API_BASE_URL}/${apiVersion}/models/${model}:${responseType}?key=${encodedApiKey}${stream ? '&alt=sse' : ''}`;

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
            
            // API 키 오류 등 에러 응답 확인 (응답이 ok이지만 에러 정보가 포함된 경우)
            if (data.error) {
                const errorMessage = data.error.message || data.error || '알 수 없는 오류가 발생했습니다.';
                throw new Error(`Gemini API 오류: ${errorMessage}`);
            }
            
            const candidates = data.candidates;
            
            if (!candidates || candidates.length === 0) {
                let errorMessage = 'Gemini API가 후보를 반환하지 않았습니다.';
                if (data.promptFeedback?.blockReason) {
                    errorMessage += ` 프롬프트가 차단되었습니다: ${data.promptFeedback.blockReason}`;
                }
                throw new Error(errorMessage);
            }

            const candidate = candidates[0];
            
            // 실리태번 방식: content가 없으면 output 확인
            const responseContent = candidate.content ?? candidate.output;
            
            // content가 문자열인 경우 (실리태번 지원)
            if (typeof responseContent === 'string') {
                return responseContent;
            }
            
            // content가 없거나 parts가 없는 경우 처리
            if (!responseContent || !responseContent.parts || !Array.isArray(responseContent.parts) || responseContent.parts.length === 0) {
                // functionCall이나 inlineData가 있는지 확인 (candidate.parts 또는 responseContent.parts)
                const parts = (responseContent?.parts || candidate.parts || []);
                const hasFunctionCall = parts.some(part => part?.functionCall);
                const hasInlineData = parts.some(part => part?.inlineData);
                
                if (hasFunctionCall || hasInlineData) {
                    return '';
                }
                
                // finishReason이 있는 경우 빈 문자열 반환 (응답이 잘렸거나 차단되었을 수 있음)
                if (candidate.finishReason) {
                    // MAX_TOKENS는 응답이 잘렸다는 의미이므로 빈 문자열 반환
                    // SAFETY, STOP 등도 유효한 응답으로 간주
                    // 테스트 메시지의 경우 빈 응답도 성공으로 처리
                    return '';
                }
                
                // finishReason도 없고 content도 없는 경우
                if (!responseContent) {
                    throw new Error('Gemini API 응답에 내용이 없습니다.');
                }
                
                // content는 있지만 parts가 없는 경우도 빈 문자열 반환 (유효한 응답)
                return '';
            }

            // parts에서 텍스트 추출
            const textParts = responseContent.parts
                .filter(part => part && part.text && !part.thought) // thought 제외
                .map(part => part.text);

            // functionCall이나 inlineData가 있는지 확인
            const hasFunctionCall = responseContent.parts.some(part => part?.functionCall);
            const hasInlineData = responseContent.parts.some(part => part?.inlineData);

            if (textParts.length === 0 && !hasFunctionCall && !hasInlineData) {
                // finishReason이 있는 경우 빈 문자열 반환 (응답이 잘렸거나 차단되었을 수 있음)
                if (candidate.finishReason) {
                    // 테스트 메시지의 경우 빈 응답도 성공으로 처리
                    return '';
                }
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

