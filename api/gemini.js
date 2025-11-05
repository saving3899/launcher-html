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
 * @returns {Promise<string|object>} 응답 텍스트 (스트리밍) 또는 { text, reasoning, rawData } 객체 (비스트리밍)
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
            let responseContent = candidate.content ?? candidate.output;
            
            // 추론(thought) 정보 추출을 위해 원본 데이터 보존
            const originalData = data;
            
            // responseContent가 문자열인 경우
            // 하지만 원본 데이터에서 parts를 확인해서 추론 추출 시도
            if (typeof responseContent === 'string' && responseContent.trim().length > 0) {
                // 원본 데이터에서 parts 확인하여 추론 추출
                // 실리태번 방식: part.thought가 true이면 그 part의 text가 추론
                let reasoning = '';
                if (candidate.content && typeof candidate.content === 'object' && candidate.content.parts) {
                    const thoughtParts = candidate.content.parts
                        .filter(part => part && typeof part === 'object' && part.thought === true && part.text)
                        .map(part => String(part.text));
                    reasoning = thoughtParts.join('\n\n');
                } else if (candidate.parts) {
                    const thoughtParts = candidate.parts
                        .filter(part => part && typeof part === 'object' && part.thought === true && part.text)
                        .map(part => String(part.text));
                    reasoning = thoughtParts.join('\n\n');
                }
                
                return {
                    text: responseContent,
                    reasoning: reasoning,
                    rawData: originalData // 추론 추출을 위해 원본 데이터 포함
                };
            }
            
            // content가 없고 output이 문자열인 경우
            if (!candidate.content && candidate.output && typeof candidate.output === 'string') {
                // 원본 데이터에서 parts 확인하여 추론 추출
                // 실리태번 방식: part.thought가 true이면 그 part의 text가 추론
                let reasoning = '';
                if (candidate.parts) {
                    const thoughtParts = candidate.parts
                        .filter(part => part && typeof part === 'object' && part.thought === true && part.text)
                        .map(part => String(part.text));
                    reasoning = thoughtParts.join('\n\n');
                }
                
                return {
                    text: candidate.output,
                    reasoning: reasoning,
                    rawData: originalData
                };
            }
            
            // responseContent가 객체인 경우 parts 확인
            let content = responseContent;
            
            // content가 없고 candidate에 직접 parts가 있는 경우
            if (!content && candidate.parts) {
                content = { parts: candidate.parts };
            }
            
            // content가 아직도 없는 경우
            if (!content) {
                throw new Error('Gemini API 응답에 내용이 없습니다.');
            }
            
            // parts가 없는 경우 빈 배열로 처리
            if (!content.parts) {
                content.parts = [];
            }

            // functionCall이나 inlineData가 있는지 확인 (실리태번과 동일)
            const hasFunctionCall = content.parts.some(part => part.functionCall);
            const hasInlineData = content.parts.some(part => part.inlineData);
            
            // parts에서 텍스트와 추론(thought) 분리 추출
            const textParts = [];
            const thoughtParts = [];
            
            content.parts.forEach(part => {
                // part가 직접 문자열인 경우 (텍스트로 처리)
                if (typeof part === 'string') {
                    textParts.push(part);
                }
                // part가 객체인 경우
                else if (typeof part === 'object' && part !== null) {
                    // 실리태번 방식: part.thought가 있으면 (boolean 플래그), 그 part의 text가 추론 내용
                    if ('thought' in part && part.thought !== null && part.thought !== undefined) {
                        // thought가 boolean이면, 그 part의 text를 추론으로 사용
                        if (typeof part.thought === 'boolean' && part.thought === true) {
                            // thought가 true인 경우, 이 part의 text는 추론 내용
                            if ('text' in part && part.text !== null && part.text !== undefined) {
                                thoughtParts.push(String(part.text));
                            }
                        } else if (typeof part.thought !== 'boolean') {
                            // thought가 문자열이거나 객체인 경우 (구형 형식?), 추론으로 추가
                            thoughtParts.push(String(part.thought));
                        }
                        // thought가 false거나 다른 값이면 무시
                    }
                    // thought가 없고 text 속성이 있는 경우 일반 메시지 텍스트로 추가
                    else if ('text' in part && part.text !== null && part.text !== undefined) {
                        textParts.push(String(part.text));
                    }
                }
            });

            // 빈 문자열도 포함 (textParts에는 빈 문자열도 포함됨)
            // 실제로 내용이 있는 텍스트만 확인하기 위한 필터
            const nonEmptyTextParts = textParts.filter(text => text && text.trim().length > 0);
            
            // 추론(thought) 추출
            const reasoning = thoughtParts.length > 0 ? thoughtParts.join('\n\n') : '';
            
            if (nonEmptyTextParts.length === 0 && !hasFunctionCall && !hasInlineData) {
                // 추론만 있고 텍스트가 없는 경우 (정상적인 경우일 수 있음)
                if (thoughtParts.length > 0 && textParts.length === 0) {
                    // 빈 텍스트와 추론 반환
                    return {
                        text: '',
                        reasoning: reasoning,
                        rawData: originalData
                    };
                }
                
                // textParts에 빈 문자열이 있는 경우 (finishReason이 STOP이면 정상 응답일 수 있음)
                if (textParts.length > 0 && textParts.every(text => text === '')) {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_API_20004', `Gemini가 빈 응답 반환 (finishReason: ${candidate.finishReason})`);
                    }
                    // 빈 문자열 반환 (사용자에게 표시될 것)
                    return {
                        text: '',
                        reasoning: reasoning,
                        rawData: originalData
                    };
                }
                
                // MAX_TOKENS인 경우 빈 문자열 반환
                if (candidate.finishReason === 'MAX_TOKENS') {
                    return {
                        text: '',
                        reasoning: reasoning,
                        rawData: originalData
                    };
                }
                
                // Safety rating 확인
                if (candidate.safetyRatings && candidate.safetyRatings.length > 0) {
                    const blockedRatings = candidate.safetyRatings.filter(r => 
                        r.probability === 'HIGH' || r.probability === 'MEDIUM'
                    );
                    if (blockedRatings.length > 0) {
                        const error = new Error(`Gemini API 응답이 Safety Settings에 의해 차단되었습니다. (${blockedRatings.map(r => `${r.category}:${r.probability}`).join(', ')})`);
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_API_10020', 'Gemini 응답이 Safety Settings에 의해 차단됨', error);
                        }
                        throw error;
                    }
                }
                
                // finishReason 확인 및 처리
                if (candidate.finishReason) {
                    if (candidate.finishReason === 'RECITATION') {
                        const error = new Error('Gemini API 응답이 RECITATION으로 차단되었습니다. 인용된 콘텐츠가 감지되었습니다.');
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_API_10021', 'Gemini 응답이 RECITATION으로 차단됨', error);
                        }
                        throw error;
                    }
                    if (candidate.finishReason === 'OTHER') {
                        const error = new Error('Gemini API 응답이 기타 이유로 차단되었습니다. 프롬프트를 확인해주세요.');
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_API_10022', 'Gemini 비정상적인 finishReason: OTHER', error);
                        }
                        throw error;
                    }
                    if (candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_API_10023', `Gemini 비정상적인 finishReason: ${candidate.finishReason}`);
                        }
                    }
                }
                
                throw new Error(`Gemini API 응답에 텍스트가 없습니다. (finishReason: ${candidate.finishReason || '없음'}) 프롬프트나 Safety Settings를 확인해주세요.`);
            }

            // functionCall이나 inlineData만 있고 텍스트가 없는 경우
            if (nonEmptyTextParts.length === 0 && (hasFunctionCall || hasInlineData)) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_API_20005', 'Gemini 텍스트 없지만 functionCall 또는 inlineData 존재');
                }
                return {
                    text: '',
                    reasoning: reasoning,
                    rawData: originalData
                };
            }

            // 텍스트 추출
            const finalText = textParts.join('\n\n');
            
            // finishReason 확인 및 로깅
            if (candidate.finishReason === 'MAX_TOKENS' && finalText.length >= 20) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_API_20006', 'Gemini MAX_TOKENS로 응답 중단');
                }
            }

            // 추론 정보를 포함한 객체 반환
            return {
                text: finalText,
                reasoning: reasoning, // 추론 내용 (thought)
                rawData: originalData // 추론 추출을 위해 원본 데이터 포함
            };
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

