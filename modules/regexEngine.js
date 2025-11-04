/**
 * 정규식 엔진 모듈
 * 실리태번의 정규식 기능을 참고하여 구현
 * 
 * ====================================================================================
 * ⚠️ 중요: 정규식 적용 시 주의사항
 * ====================================================================================
 * 
 * [1] 직접 편집 (isEdit: true)
 *     - 메시지 편집 모드에서 정규식이 적용됩니다
 *     - runOnEdit이 true인 스크립트만 적용됩니다
 *     - isMarkdown은 undefined로 전달되어 마크다운 전용 스크립트는 적용되지 않습니다
 *     - 수정 시: saveEdit, editMessage 함수에서 isEdit: true로 전달 확인
 * 
 * [2] 형식 표시만 (isMarkdown: true)
 *     - 마크다운 렌더링된 메시지 표시 시 적용됩니다
 *     - markdownOnly가 true인 스크립트만 적용됩니다
 *     - 수정 시: addMessage, loadChat, loadMoreMessagesFromStart에서 isMarkdown: true로 전달 확인
 * 
 * [3] 형식 프롬프트만 (isPrompt: true)
 *     - 프롬프트 생성 시 적용됩니다
 *     - promptOnly가 true인 스크립트만 적용됩니다
 *     - 수정 시: 프롬프트 생성 관련 함수에서 isPrompt: true로 전달 확인
 * 
 * [4] Replace With이 공백일 때
 *     - replaceString이 빈 문자열이면 매칭된 부분이 삭제됩니다 (빈 문자열로 치환)
 *     - 이는 의도적인 동작입니다 (실리태번과 동일)
 *     - 수정 시: runRegexScript에서 replaceString 처리 로직 확인
 * 
 * [5] HTML 렌더링 제한과의 우선순위
 *     - ⚠️ 중요: HTML 렌더링 제한이 정규식보다 우선 적용됩니다
 *     - 정규식은 먼저 적용되어 텍스트를 변환하지만, HTML 렌더링 제한에 의해
 *       최근 N개가 아닌 메시지는 플레이스홀더로 표시됩니다
 *     - 즉, 정규식이 적용된 HTML 콘텐츠도 렌더링 제한에 따라 플레이스홀더로 표시됩니다
 *     - 수정 시: applyHtmlRenderLimit이 renderHtmlIframesInElement 호출 전에 실행되는지 확인
 * 
 * [6] 적용 시점
 *     - 정규식과 HTML 렌더링 제한은 다음 모든 시점에 적용되어야 합니다:
 *       * 편집 적용 (saveEdit)
 *       * 편집 취소 (cancelEdit)
 *       * 채팅 로드 (loadChat)
 *       * 더보기 (loadMoreMessagesFromStart)
 *     - 수정 시: 모든 메시지 렌더링 함수에서 정규식 적용 후 HTML 렌더링 제한 적용 확인
 * 
 * ====================================================================================
 */

// 매크로 치환 함수는 동기적으로 사용하므로 직접 import

/**
 * 정규식 적용 위치 열거형
 */
const REGEX_PLACEMENT = {
    USER_INPUT: 1,
    AI_OUTPUT: 2,
    SLASH_COMMAND: 3,
    WORLD_INFO: 5,
    REASONING: 6,
};

/**
 * Find Regex 매크로 치환 방식
 */
const SUBSTITUTE_FIND_REGEX = {
    NONE: 0,      // 치환하지 않음
    RAW: 1,       // 매크로 치환 (raw)
    ESCAPED: 2,   // 매크로 치환 (escaped)
};

/**
 * 문자열에서 RegExp 생성 (플래그 포함)
 * 실리태번의 regexFromString 구현을 따름
 * @param {string} input - 정규식 패턴 문자열 (예: "/pattern/gim" 또는 "pattern")
 * @returns {RegExp|undefined} 생성된 RegExp 객체 또는 undefined (실패 시)
 */
function regexFromString(input) {
    if (!input || typeof input !== 'string') {
        return undefined;
    }

    try {
        // 실리태번의 구현과 정확히 동일하게
        // Parse input
        var m = input.match(/(\/?)(.+)\1([a-z]*)/i);
        
        // 매칭 실패 시 undefined 반환
        if (!m || !m[2]) {
            return undefined;
        }

        // Invalid flags
        if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3])) {
            return RegExp(input);
        }

        // Create the regular expression
        // {0} 같은 특수 패턴을 이스케이프하여 "Nothing to repeat" 오류 방지
        let pattern = m[2];
        
        // 정규식 특수 문자가 있지만 패턴이 유효한지 확인
        // {0} 같은 패턴은 이스케이프 필요
        try {
            return new RegExp(pattern, m[3]);
        } catch (regexError) {
            // 정규식 생성 실패 시 (예: "Nothing to repeat" 오류)
            // 패턴을 이스케이프하여 재시도
            const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(escapedPattern, m[3]);
        }
    } catch {
        return undefined;
    }
}

/**
 * 정규식 매크로 이스케이프 함수
 * 실리태번의 sanitizeRegexMacro 함수와 동일 (engine.js 249-269번 라인)
 * @param {string|any} x - 이스케이프할 값
 * @returns {string|any} 이스케이프된 문자열
 */
function sanitizeRegexMacro(x) {
    return (x && typeof x === 'string') ?
        x.replaceAll(/[\n\r\t\v\f\0.^$*+?{}[\]\\/|()]/gs, function (s) {
            switch (s) {
                case '\n':
                    return '\\n';
                case '\r':
                    return '\\r';
                case '\t':
                    return '\\t';
                case '\v':
                    return '\\v';
                case '\f':
                    return '\\f';
                case '\0':
                    return '\\0';
                default:
                    return '\\' + s;
            }
        }) : x;
}

/**
 * 정규식 매칭에서 trim 문자열 제거
 * 실리태번의 filterString 함수와 동일 (engine.js 402-410번 라인)
 * @param {string} rawString - 원본 문자열
 * @param {string[]} trimStrings - 제거할 문자열 배열
 * @param {Object} params - 추가 파라미터
 * @param {string} params.characterOverride - 캐릭터 이름 오버라이드
 * @returns {string} 필터링된 문자열
 */
function filterString(rawString, trimStrings = [], { characterOverride } = {}) {
    if (!trimStrings || trimStrings.length === 0) {
        return rawString;
    }

    let finalString = rawString;
    // 실리태번과 동일: trimStrings에도 매크로 치환 적용 (405번 라인)
    trimStrings.forEach((trimString) => {
        if (trimString) {
            const subTrimString = substituteParams(trimString, undefined, characterOverride);
            finalString = finalString.replaceAll(subTrimString, '');
        }
    });

    return finalString;
}

/**
 * 단일 정규식 스크립트 실행
 * 실리태번의 runRegexScript 함수와 동일 (engine.js 336-393번 라인)
 * @param {Object} regexScript - 정규식 스크립트 객체
 * @param {string} rawString - 처리할 문자열
 * @param {Object} params - 파라미터 객체
 * @param {string} params.characterOverride - 캐릭터 이름 오버라이드
 * @returns {string} 처리된 문자열
 */
function runRegexScript(regexScript, rawString, { characterOverride, userName, charName } = {}) {
    let newString = rawString;
    
    // 실리태번과 동일: 유효성 검사 (338번 라인)
    if (!regexScript || !!(regexScript.disabled) || !regexScript?.findRegex || !rawString) {
        return newString;
    }

    // 실리태번과 동일: substituteRegex 옵션에 따라 Find Regex에 매크로 치환 적용 (342-354번 라인)
    const getRegexString = () => {
        const substituteRegex = Number(regexScript.substituteRegex) || SUBSTITUTE_FIND_REGEX.NONE;
        switch (substituteRegex) {
            case SUBSTITUTE_FIND_REGEX.NONE:
                return regexScript.findRegex;
            case SUBSTITUTE_FIND_REGEX.RAW:
                // substituteParamsExtended로 매크로 치환 (RAW)
                return substituteParamsExtended(regexScript.findRegex);
            case SUBSTITUTE_FIND_REGEX.ESCAPED:
                // substituteParamsExtended로 매크로 치환 후 이스케이프 (ESCAPED)
                return substituteParamsExtended(regexScript.findRegex, {}, sanitizeRegexMacro);
            default:
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_REGEX_20002', `알 수 없는 substituteRegex 값: ${regexScript.substituteRegex}`);
                }
                return regexScript.findRegex;
        }
    };
    
    // 실리태번과 동일: 매크로 치환된 Find Regex 사용 (355번 라인)
    const regexString = getRegexString();
    
    const findRegex = regexFromString(regexString);
    
    // 실리태번과 동일: 정규식 생성 실패 시 원본 반환 (359번 라인)
    if (!findRegex) {
        // 경고 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('WARN_REGEX_20003', `정규식 생성 실패: ${regexScript.scriptName || '이름 없음'}`);
        }
        return newString;
    }

    // 실리태번과 동일: replace 사용 (364번 라인)
    // 실리태번에서는 global 플래그 없이 replace를 사용하지만, 모든 매칭을 처리하기 위해
    // g 플래그가 없으면 추가하여 모든 매칭 처리
    const globalRegex = findRegex.global ? findRegex : new RegExp(findRegex.source, findRegex.flags + 'g');
    
    // test() 결과 확인 (lastIndex 영향 방지를 위해 새 정규식으로 테스트)
    const testRegex = new RegExp(globalRegex.source, globalRegex.flags);
    const hasMatch = testRegex.test(rawString);
    
    // 매칭이 없으면 원본 반환 (불필요한 replace() 실행 방지)
    if (!hasMatch) {
        return newString;
    }
    
    // 실리태번과 동일: 정규식 교체 실행 (364번 라인)
    newString = rawString.replace(globalRegex, function (match) {
        const args = [...arguments];
        // replaceString이 undefined나 null이면 빈 문자열로, 그 외에는 그대로 사용
        // 실리태번과 동일: replaceString이 항상 문자열이라고 가정하고 .replace()를 바로 호출
        // 중요: replaceString이 빈 문자열이면 매칭된 부분이 삭제됨 (빈 문자열로 치환)
        let replaceString = (regexScript.replaceString != null && typeof regexScript.replaceString === 'string') 
            ? regexScript.replaceString 
            : '';

        // 디버깅: 매칭 정보
        console.debug(`[정규식 매칭] 패턴: ${globalRegex.source}, 매칭: ${match}, 위치: ${args[args.length - 2]}, replaceString: "${replaceString}" (길이: ${replaceString.length})`);

        // {{match}}를 $0으로 치환 (실리태번과 동일: 빈 문자열 체크 전에 처리)
        replaceString = replaceString.replace(/{{match}}/gi, '$0');

        // 실리태번과 동일: Capture groups 처리 (367번 라인)
        const replaceWithGroups = replaceString.replaceAll(/\$(\d+)|\$<([^>]+)>/g, (_, num, groupName) => {
            let match = '';
            
            if (num) {
                // Numbered capture groups ($1, $2, etc.)
                match = args[Number(num)];
            } else if (groupName) {
                // Named capture groups ($<name>)
                const groups = args[args.length - 1];
                match = groups && typeof groups === 'object' && groups[groupName];
            }

            // 실리태번과 동일: No match found - return the empty string (378번 라인)
            if (!match) {
                return '';
            }

            // 실리태번과 동일: Remove trim strings from the match (383번 라인)
            const filteredMatch = filterString(match, regexScript.trimStrings, { characterOverride });

            return filteredMatch;
        });

        // 실리태번과 동일: Substitute at the end (389번 라인)
        // userName과 charName을 전달하여 {{user}}, {{char}} 매크로 치환
        const finalReplaceString = substituteParams(replaceWithGroups, userName || '', charName || '');

        // 실리태번과 동일: 매크로 치환 결과를 그대로 반환 (빈 문자열도 유효한 값)
        // Replace With가 빈 문자열이면 매칭된 부분이 빈 문자열로 치환됨 (삭제)
        // capture groups가 모두 빈 문자열이면 결과도 빈 문자열이 됨
        return finalReplaceString;
    });
    
    // 매칭 결과 확인
    if (newString === rawString) {
        console.debug(`[runRegexScript] 정규식 매칭 없음: ${regexScript.scriptName || '이름 없음'}`);
    }

    return newString;
}

/**
 * 문자열에 모든 정규식 스크립트 적용
 * 실리태번과 동일한 로직 구현
 * @param {string} rawString - 원본 문자열
 * @param {number} placement - 적용 위치 (REGEX_PLACEMENT)
 * @param {Object} options - 옵션 객체
 * @param {string} options.characterOverride - 캐릭터 이름 오버라이드
 * @param {boolean} options.isEdit - 편집 모드 여부
 * @param {boolean} options.isMarkdown - 마크다운 표시 모드 여부
 * @param {boolean} options.isPrompt - 프롬프트 생성 모드 여부
 * @param {number} options.depth - 메시지 깊이 (0=가장 최근, 높을수록 과거)
 * @returns {Promise<string>} 처리된 문자열
 */
async function getRegexedString(rawString, placement, options = {}) {
    // 실리태번과 동일: 문자열 타입 체크
    if (typeof rawString !== 'string') {
        console.warn('[getRegexedString] rawString이 문자열이 아님:', typeof rawString);
        // 경고 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('WARN_REGEX_20004', 'rawString이 문자열이 아님');
        }
        return '';
    }

    if (!rawString || placement === undefined) {
        return rawString;
    }
    
    // ⚠️ 중요: 캐릭터 ID 결정
    // 1. characterOverride가 있으면 해당 캐릭터 이름으로 캐릭터 찾기
    // 2. 없으면 chatManager.currentCharacterId 사용
    // 3. 그것도 없으면 CharacterStorage.loadCurrent() 사용 (fallback)
    let targetCharacterId = null;
    
    if (options.characterOverride) {
        // characterOverride가 있으면 해당 이름으로 캐릭터 찾기
        try {
            const allCharacters = await CharacterStorage.loadAll();
            const foundCharacter = Object.entries(allCharacters).find(([id, char]) => {
                const name = char?.data?.name || char?.name || '';
                return name === options.characterOverride;
            });
            if (foundCharacter) {
                targetCharacterId = foundCharacter[0];
            }
        } catch (error) {
            console.warn('[getRegexedString] characterOverride로 캐릭터 찾기 실패:', error);
        }
    }
    
    // characterOverride로 찾지 못했으면 chatManager.currentCharacterId 사용
    if (!targetCharacterId) {
        try {
            if (typeof window !== 'undefined' && window.chatManager) {
                targetCharacterId = window.chatManager.currentCharacterId;
            }
        } catch (error) {
            // chatManager에 접근할 수 없으면 무시
        }
    }
    
    // 그것도 없으면 CharacterStorage.loadCurrent() 사용 (fallback)
    if (!targetCharacterId) {
        try {
            targetCharacterId = await CharacterStorage.loadCurrent();
        } catch (error) {
            console.error('[getRegexedString] CharacterStorage 로드 실패:', error);
        }
    }
    
    // 캐릭터가 선택되지 않은 상태(홈 화면)에서는 정규식 없이 원본 반환
    if (!targetCharacterId) {
        return rawString;
    }

    // 정규식 스크립트 로드
    // RegexScriptStorage, CharacterStorage - 전역 스코프에서 사용
    
    // 글로벌 정규식 로드
    const globalScripts = await RegexScriptStorage.loadAll();
    
    // 타겟 캐릭터 한정 정규식 로드
    let characterScripts = {};
    if (targetCharacterId) {
        characterScripts = await RegexScriptStorage.loadCharacterRegex(targetCharacterId);
    }
    
    // 모든 스크립트 병합 (글로벌 + 캐릭터 한정)
    const allScripts = { ...globalScripts, ...characterScripts };

    // userName과 charName 가져오기 (정규식 Replace With의 {{user}}, {{char}} 치환용)
    let userName = options.userName;
    let charName = options.characterOverride || options.charName || '';
    
    // options에서 제공되지 않으면 storage에서 가져오기
    if (userName === undefined || !charName) {
        try {
            // SettingsStorage, UserPersonaStorage, CharacterStorage - 전역 스코프에서 사용
            
            // userName 가져오기
            if (userName === undefined) {
                const settings = await SettingsStorage.load();
                const currentPersonaId = settings.currentPersonaId;
                if (currentPersonaId) {
                    const persona = await UserPersonaStorage.load(currentPersonaId);
                    if (persona?.name) {
                        userName = persona.name;
                    } else {
                        userName = '';
                    }
                } else {
                    userName = '';
                }
            }
            
            // charName 가져오기
            if (!charName) {
                const currentCharacterId = await CharacterStorage.loadCurrent();
                if (currentCharacterId) {
                    const character = await CharacterStorage.load(currentCharacterId);
                    if (character?.data?.name || character?.name) {
                        charName = character.data?.name || character.name;
                    }
                }
            }
        } catch (error) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_REGEX_20005', '사용자/캐릭터 정보 로드 실패 (regexEngine)', error);
            }
            userName = userName || '';
        }
    }

    let finalString = rawString;

    // 모든 활성화된 스크립트에 대해 순차적으로 적용
    const scripts = Object.values(allScripts).filter(s => s && !s.disabled);
    
    // 실리태번과 동일한 로직 (engine.js 292-323번 라인)
    // 실리태번은 forEach를 사용하지만, 우리는 for...of를 사용 (동일한 효과)
    for (const script of scripts) {
        // 실리태번과 동일: ephemerality 체크를 먼저 수행 (293-299번 라인)
        const isMarkdown = options.isMarkdown;
        const isPrompt = options.isPrompt;
        
        // 실리태번과 정확히 동일한 조건 구조
        // (script.markdownOnly && isMarkdown) || (script.promptOnly && isPrompt) || (!script.markdownOnly && !script.promptOnly && !isMarkdown && !isPrompt)
        const shouldApplyEphemerality = 
            // Script applies to Markdown and input is Markdown
            (script.markdownOnly && isMarkdown) ||
            // Script applies to Generate and input is Generate
            (script.promptOnly && isPrompt) ||
            // Script applies to all cases when neither "only"s are true, but there's no need to do it when `isMarkdown`, the as source (chat history) should already be changed beforehand
            (!script.markdownOnly && !script.promptOnly && !isMarkdown && !isPrompt);

        // Ephemerality 조건을 만족하지 않으면 스킵
        if (!shouldApplyEphemerality) {
            continue;
        }

        // 실리태번과 동일: 편집 모드 확인 (301-304번 라인)
        // 편집 모드일 때: runOnEdit이 true인 스크립트만 적용
        // 중요: 이 체크는 ephemerality 조건 안에 있어야 함 (실리태번 구조와 동일)
        if (options.isEdit && !script.runOnEdit) {
            continue;
        }

        // 실리태번과 동일: 깊이 체크 (307-316번 라인)
        const { depth } = options;
        if (typeof depth === 'number') {
            if (!isNaN(script.minDepth) && script.minDepth !== null && script.minDepth >= -1 && depth < script.minDepth) {
                console.debug(`[정규식] 스킵: ${script.scriptName || '이름 없음'} - depth ${depth}가 minDepth ${script.minDepth}보다 작습니다.`);
                continue;
            }

            if (!isNaN(script.maxDepth) && script.maxDepth !== null && script.maxDepth >= 0 && depth > script.maxDepth) {
                console.debug(`[정규식] 스킵: ${script.scriptName || '이름 없음'} - depth ${depth}가 maxDepth ${script.maxDepth}보다 큽니다.`);
                continue;
            }
        }

        // 실리태번과 동일: placement 확인 (319번 라인)
        // 실리태번은 script.placement.includes(placement)만 체크하지만, 우리는 안전하게 null 체크도 수행
        if (!script.placement || !Array.isArray(script.placement) || !script.placement.includes(placement)) {
            console.debug(`[정규식] 스킵: ${script.scriptName || '이름 없음'} - placement 불일치 (스크립트: [${script.placement?.join(', ')}], 요청: ${placement})`);
            continue;
        }

        // 실리태번과 동일: runRegexScript에 characterOverride 전달 (320번 라인)
        // userName과 charName도 전달하여 Replace With의 {{user}}, {{char}} 치환
        const { characterOverride } = options;
        finalString = runRegexScript(script, finalString, { characterOverride, userName, charName });
    }
    
    console.debug(`[getRegexedString] 완료: 원본 "${rawString.substring(0, 50)}${rawString.length > 50 ? '...' : ''}" → 결과 "${finalString.substring(0, 50)}${finalString.length > 50 ? '...' : ''}"`);

    return finalString;
}

