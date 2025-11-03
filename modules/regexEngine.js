/**
 * 정규식 엔진 모듈
 * 실리태번의 정규식 기능을 참고하여 구현
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
        // replaceString이 undefined나 null이면 빈 문자열로, 그 외에는 그대로 사용 (빈 문자열도 유효한 값)
        let replaceString = regexScript.replaceString != null ? regexScript.replaceString : '';

        // 디버깅: 매칭 정보
        console.debug(`[정규식 매칭] 패턴: ${globalRegex.source}, 매칭: ${match}, 위치: ${args[args.length - 2]}, replaceString: "${replaceString}" (길이: ${replaceString.length})`);

        // replaceString이 빈 문자열이거나 공백만 있으면 매칭된 문자열을 삭제
        if (replaceString === '' || (typeof replaceString === 'string' && replaceString.trim() === '')) {
            console.debug(`[정규식 교체] replaceString이 비어있어서 매칭 삭제: "${match}"`);
            return '';
        }

        // {{match}}를 $0으로 치환
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

        // 최종 결과가 빈 문자열이거나 공백만 있으면 매칭된 문자열을 삭제
        if (finalReplaceString === '' || (typeof finalReplaceString === 'string' && finalReplaceString.trim() === '')) {
            return '';
        }

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
        // 경고 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('WARN_REGEX_20004', 'rawString이 문자열이 아님');
        }
        return '';
    }

    if (!rawString || placement === undefined) {
        return rawString;
    }
    
    // 홈 화면이거나 채팅이 없는 상태에서는 정규식 실행하지 않음 (불필요한 처리 방지)
    // 현재 캐릭터가 선택되어 있는지 확인
    try {
        const currentCharacterId = await CharacterStorage.loadCurrent();
        if (!currentCharacterId) {
            // 캐릭터가 선택되지 않은 상태(홈 화면)에서는 정규식 없이 원본 반환
            return rawString;
        }
    } catch (error) {
        // CharacterStorage 로드 실패 시에도 원본 반환 (안전하게 처리)
        return rawString;
    }

    // 정규식 스크립트 로드
    // RegexScriptStorage, CharacterStorage - 전역 스코프에서 사용
    
    // 글로벌 정규식 로드
    const globalScripts = await RegexScriptStorage.loadAll();
    
    // 현재 캐릭터 한정 정규식 로드 (캐릭터가 선택된 경우에만)
    const currentCharacterId = await CharacterStorage.loadCurrent();
    let characterScripts = {};
    if (currentCharacterId) {
        characterScripts = await RegexScriptStorage.loadCharacterRegex(currentCharacterId);
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
    for (const script of scripts) {
        // 비활성화된 스크립트 건너뛰기
        if (script.disabled) {
            console.debug(`[정규식] 스킵: ${script.scriptName || '이름 없음'} - 비활성화됨`);
            continue;
        }

        // Ephemerality 체크 (markdownOnly, promptOnly)
        // 실리태번과 동일: engine.js 293-299번 라인
        // - markdownOnly가 true: isMarkdown이 truthy일 때만 적용 (UI 표시 시에만)
        // - promptOnly가 true: isPrompt가 truthy일 때만 적용 (프롬프트 생성 시에만)
        // - 둘 다 false: !isMarkdown && !isPrompt일 때만 적용 (원본 텍스트 자체에만 적용)
        // 주의: isMarkdown이 undefined이면 !isMarkdown은 true가 됨 (직접 편집 시 적용)
        // 실리태번 코드: (script.markdownOnly && isMarkdown) || (script.promptOnly && isPrompt) || (!script.markdownOnly && !script.promptOnly && !isMarkdown && !isPrompt)
        // 중요: 실리태번에서는 options 객체에서 직접 구조 분해하므로 undefined가 명시적으로 전달되어도 정상 작동
        const isMarkdown = options.isMarkdown;
        const isPrompt = options.isPrompt;
        
        // 실리태번과 정확히 동일한 조건 구조
        // markdownOnly가 true인 경우: isMarkdown이 truthy여야 함 (undefined는 falsy이므로 적용 안 됨)
        // promptOnly가 true인 경우: isPrompt가 truthy여야 함 (undefined는 falsy이므로 적용 안 됨)
        // 둘 다 false인 경우: !isMarkdown && !isPrompt여야 함 (undefined는 !undefined = true)
        const shouldApplyEphemerality = 
            // Script applies to Markdown and input is Markdown
            (script.markdownOnly && isMarkdown) ||
            // Script applies to Generate and input is Generate
            (script.promptOnly && isPrompt) ||
            // Script applies to all cases when neither "only"s are true, but there's no need to do it when `isMarkdown`, the as source (chat history) should already be changed beforehand
            (!script.markdownOnly && !script.promptOnly && !isMarkdown && !isPrompt);

        // Ephemerality 조건을 만족하지 않으면 스킵
        if (!shouldApplyEphemerality) {
            // 디버그: markdownOnly가 true인데 적용되지 않는 경우 명확히 표시
            if (script.markdownOnly && !isMarkdown) {
                console.debug(`[정규식] 스킵: ${script.scriptName || '이름 없음'} - markdownOnly가 true이지만 isMarkdown이 ${isMarkdown} (truthy가 아님)`);
            } else {
            console.debug(`[정규식] 스킵: ${script.scriptName || '이름 없음'} - Ephemerality 불일치 (markdownOnly: ${script.markdownOnly}, promptOnly: ${script.promptOnly}, isMarkdown: ${isMarkdown}, isPrompt: ${isPrompt})`);
            }
            continue;
        }

        // 실리태번과 동일: 편집 모드 확인
        // 편집 모드일 때: runOnEdit이 true인 스크립트만 적용
        // 편집 모드가 아닐 때: 모든 스크립트 적용 (runOnEdit과 무관)
        if (options.isEdit) {
            if (!script.runOnEdit) {
                console.debug(`[정규식] 스킵: ${script.scriptName || '이름 없음'} - runOnEdit이 false이고 편집 모드입니다.`);
                continue;
            }
        }

        // 실리태번과 동일: 깊이 체크 (minDepth, maxDepth)
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

        // 실리태번과 동일: placement 확인
        if (!script.placement || !script.placement.includes(placement)) {
            console.debug(`[정규식] 스킵: ${script.scriptName || '이름 없음'} - placement 불일치 (스크립트: [${script.placement?.join(', ')}], 요청: ${placement})`);
            continue;
        }

        // 실리태번과 동일: runRegexScript에 characterOverride 전달 (320번 라인)
        // userName과 charName도 전달하여 Replace With의 {{user}}, {{char}} 치환
        const { characterOverride } = options;
        finalString = runRegexScript(script, finalString, { characterOverride, userName, charName });
    }

    return finalString;
}

