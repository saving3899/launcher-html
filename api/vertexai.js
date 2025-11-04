/**
 * Google Vertex AI 통신 모듈
 * 실리태번 방식 참고, 클라이언트 사이드에서 직접 호출
 * Express 모드와 Full 모드 모두 지원
 * Full 모드는 Web Crypto API를 사용하여 Service Account 인증 지원
 */


/**
 * Google Vertex AI 호출 (Express 모드와 Full 모드 모두 지원)
 * @param {object} options - API 옵션
 * @param {string} options.apiKey - API 키 (Express 모드만 필요)
 * @param {string} options.model - 모델 이름
 * @param {Array} options.messages - 메시지 배열 [{ role, content }]
 * @param {number} options.temperature - 온도 (0-2)
 * @param {number} options.maxTokens - 최대 토큰 수
 * @param {Array<string>} options.stopSequences - 정지 시퀀스
 * @param {boolean} options.stream - 스트리밍 여부
 * @param {AbortSignal} options.signal - 취소 신호
 * @param {Function} options.onChunk - 스트리밍 청크 콜백
 * @param {object} options.systemInstruction - 시스템 인스트럭션 (선택사항)
 * @param {string} options.authMode - 인증 모드 ('express' 또는 'full')
 * @param {string} options.region - Region (기본값: 'us-central1')
 * @param {string} options.projectId - Project ID (Full 모드에서는 Service Account에서 추출)
 * @param {object} options.serviceAccountJson - Service Account JSON 객체 (Full 모드만 필요)
 * @param {string} options.reasoningEffort - Reasoning effort ('auto', 'min', 'low', 'medium', 'high', 'max')
 * @param {boolean} options.includeReasoning - Reasoning thoughts 포함 여부
 * @param {boolean} options.enableWebSearch - 웹 검색 활성화
 * @param {boolean} options.requestImages - 이미지 요청 활성화
 * @param {boolean} options.useSysprompt - 시스템 프롬프트 사용
 * @returns {Promise<string>} 응답 텍스트
 */
async function callVertexAI({
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
    authMode = 'express',
    region = 'us-central1',
    projectId = null,
    serviceAccountJson = null,
    reasoningEffort = 'auto',
    includeReasoning = false,
    enableWebSearch = false,
    requestImages = false,
    useSysprompt = false,
    seed = undefined, // seed 파라미터 추가
}) {
    // 인증 모드에 따른 처리
    let accessToken = null;
    let finalProjectId = projectId;
    
    if (authMode === 'full') {
        // Full 모드: Service Account JSON 사용
        if (!serviceAccountJson) {
            throw new Error('Vertex AI Full 모드에는 Service Account JSON이 필요합니다.');
        }

        // Service Account JSON 파싱
        let serviceAccount;
        if (typeof serviceAccountJson === 'string') {
            try {
                serviceAccount = JSON.parse(serviceAccountJson);
            } catch (error) {
                throw new Error('Service Account JSON을 파싱할 수 없습니다: ' + error.message);
            }
        } else {
            serviceAccount = serviceAccountJson;
        }

        // Project ID 추출 (없으면 Service Account에서 가져오기)
        if (!finalProjectId) {
            try {
                finalProjectId = getProjectIdFromServiceAccount(serviceAccount);
            } catch (error) {
                throw new Error('Project ID를 찾을 수 없습니다. Service Account JSON에 project_id가 있는지 확인하세요.');
            }
        }

        // JWT 토큰 생성 및 Access Token 획득
        try {
            const jwtToken = await generateJWTToken(serviceAccount);
            accessToken = await getAccessToken(jwtToken);
        } catch (error) {
            throw new Error('Vertex AI 인증 실패: ' + error.message);
        }
    } else {
        // Express 모드: API Key 사용
        if (!apiKey) {
            throw new Error('Google Vertex AI API 키가 필요합니다.');
        }
    }

    // 메시지를 Gemini 형식으로 변환 (Vertex AI도 동일한 형식 사용)
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
    
    // seed 파라미터 추가 (Vertex AI는 seed를 지원함, seed가 정의되어 있고 >= 0일 때만)
    if (seed !== undefined && seed >= 0) {
        generationConfig.seed = seed;
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
            
            // Vertex AI: thinkingBudget이 0이고 includeThoughts가 true면 false로 변경
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

    const responseType = stream ? 'streamGenerateContent' : 'generateContent';
    
    // Region에 따른 base URL 결정
    let baseUrl;
    if (region === 'global') {
        baseUrl = 'https://aiplatform.googleapis.com';
    } else {
        baseUrl = `https://${region}-aiplatform.googleapis.com`;
    }

    // URL 및 헤더 구성 (SillyTavern 방식 참고)
    let url;
    let headers = {
        'Content-Type': 'application/json',
    };

    if (authMode === 'express') {
        // Express 모드: API Key를 URL 파라미터로 전달
        if (finalProjectId) {
            url = `https://aiplatform.googleapis.com/v1/projects/${finalProjectId}/locations/${region}/publishers/google/models/${model}:${responseType}?key=${apiKey}`;
        } else {
            url = `${baseUrl}/v1/publishers/google/models/${model}:${responseType}?key=${apiKey}`;
        }
        if (stream) {
            url += '&alt=sse';
        }
    } else {
        // Full 모드: Authorization 헤더 사용, Project ID 필수
        if (region === 'global') {
            url = `https://aiplatform.googleapis.com/v1/projects/${finalProjectId}/locations/${region}/publishers/google/models/${model}:${responseType}`;
        } else {
            url = `https://${region}-aiplatform.googleapis.com/v1/projects/${finalProjectId}/locations/${region}/publishers/google/models/${model}:${responseType}`;
        }
        if (stream) {
            url += '?alt=sse';
        }
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
            signal: signal,
        });

        if (stream) {
            // 스트리밍 응답 처리 (Gemini SSE 형식과 동일)
            return await parseStreamingResponse(response, 'gemini', {
                onChunk: onChunk,
                onError: (error) => {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_API_10001', 'Vertex AI 스트리밍 오류', error);
                    }
                    throw error;
                },
                signal: signal, // signal 전달
            });
        } else {
            // 비스트리밍 응답 처리
            if (!response.ok) {
                throw await handleApiError(response);
            }

            const data = await response.json();
            const candidates = data.candidates;
            
            if (!candidates || candidates.length === 0) {
                let errorMessage = 'Vertex AI가 후보를 반환하지 않았습니다.';
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
                
                console.log('[callVertexAI] 문자열 responseContent 처리:', {
                    textLength: responseContent.length,
                    textPreview: responseContent.substring(0, 200),
                    reasoningLength: reasoning.length,
                    reasoningPreview: reasoning.substring(0, 200),
                    hasContentParts: !!(candidate.content?.parts),
                    hasParts: !!candidate.parts,
                    contentPartsCount: candidate.content?.parts?.length || 0,
                    partsCount: candidate.parts?.length || 0
                });
                
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
                throw new Error('Vertex AI 응답에 내용이 없습니다.');
            }
            
            // parts가 없는 경우 빈 배열로 처리
            if (!content.parts) {
                content.parts = [];
            }

            // functionCall이나 inlineData가 있는지 확인 (실리태번과 동일)
            const hasFunctionCall = content.parts.some(part => part.functionCall);
            const hasInlineData = content.parts.some(part => part.inlineData);
            
            // parts 구조 상세 확인
            const partsAnalysis = content.parts.map((part, idx) => {
                // part가 문자열인 경우
                if (typeof part === 'string') {
                    return {
                        index: idx,
                        type: 'string',
                        text: part,
                        textLength: part.length,
                        textPreview: part.substring(0, 50)
                    };
                }
                // part가 객체인 경우
                return {
                    index: idx,
                    type: 'object',
                    hasText: !!part.text,
                    hasThought: !!part.thought,
                    hasFunctionCall: !!part.functionCall,
                    hasInlineData: !!part.inlineData,
                    textLength: part.text?.length || 0,
                    textPreview: part.text ? part.text.substring(0, 50) : null,
                    keys: Object.keys(part),
                    fullPart: part
                };
            });
            
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
                        showErrorCodeToast('WARN_API_20001', `Vertex AI가 빈 응답 반환 (finishReason: ${candidate.finishReason})`);
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
                        const error = new Error(`Vertex AI 응답이 Safety Settings에 의해 차단되었습니다. (${blockedRatings.map(r => `${r.category}:${r.probability}`).join(', ')})`);
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_API_10002', 'Vertex AI 응답이 Safety Settings에 의해 차단됨', error);
                        }
                        throw error;
                    }
                }
                
                // finishReason 확인 및 처리
                if (candidate.finishReason) {
                    if (candidate.finishReason === 'RECITATION') {
                        const error = new Error('Vertex AI 응답이 RECITATION으로 차단되었습니다. 인용된 콘텐츠가 감지되었습니다.');
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_API_10003', 'Vertex AI 응답이 RECITATION으로 차단됨', error);
                        }
                        throw error;
                    }
                    if (candidate.finishReason === 'OTHER') {
                        const error = new Error('Vertex AI 응답이 기타 이유로 차단되었습니다. 프롬프트를 확인해주세요.');
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_API_10004', 'Vertex AI 비정상적인 finishReason: OTHER', error);
                        }
                        throw error;
                    }
                    if (candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_API_10005', `Vertex AI 비정상적인 finishReason: ${candidate.finishReason}`);
                        }
                    }
                }
                
                throw new Error(`Vertex AI 응답에 텍스트가 없습니다. (finishReason: ${candidate.finishReason || '없음'}) 프롬프트나 Safety Settings를 확인해주세요.`);
            }

            // functionCall이나 inlineData만 있고 텍스트가 없는 경우
            if (nonEmptyTextParts.length === 0 && (hasFunctionCall || hasInlineData)) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_API_20002', 'Vertex AI 텍스트 없지만 functionCall 또는 inlineData 존재');
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
                    showErrorCodeToast('WARN_API_20003', 'Vertex AI MAX_TOKENS로 응답 중단');
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

